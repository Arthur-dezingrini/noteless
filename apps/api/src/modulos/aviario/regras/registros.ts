import type { pesagemLoteInputSchema, vacinacaoLoteInputSchema, valoresApontamentoSchema } from "@vocare/shared";
import type { z } from "zod";

import { br, hojeISO } from "../../../base/datas";
import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { pesagemLote, vacinacaoLote } from "../../../db/tabelas/aviario";
import { avisarGalpaoSemSilo, avisarSaldoNegativo, baixarInsumo, sincronizarRacao } from "../../estoque";
import { acharLote, avesVivasNoDia } from "../consultas/lotes";
import { nomeDaInstalacao } from "./alojamento";
import { substituirApontamento, validarApontamento } from "./apontamento";
import { capturar, FalhaLote } from "./falha";

const NAO_ENCONTRADO = "Lote não encontrado.";

/** Grava (substituindo) o apontamento do galpão no dia, conferindo que o lote estava lá. */
export async function lancarApontamento(
  orgId: string,
  userId: string,
  id: string,
  instalacaoId: string,
  data: string,
  valores: z.infer<typeof valoresApontamentoSchema>,
): Promise<Resultado<void>> {
  const alvo = await acharLote(orgId, id);
  if (!alvo) return falha(404, NAO_ENCONTRADO);
  if (!(await nomeDaInstalacao(db, orgId, instalacaoId))) return falha(404, "Galpão não encontrado.");

  let baixa: Awaited<ReturnType<typeof sincronizarRacao>> = { semSilo: false, mexeu: [] };
  const r = await capturar(() =>
    db.transaction(async (tx) => {
      const valida = await validarApontamento(tx, orgId, instalacaoId, data, valores, "substituir");
      if (typeof valida === "string") throw new FalhaLote(422, valida);
      if (valida.loteId !== id) {
        const nome = await nomeDaInstalacao(tx, orgId, instalacaoId);
        throw new FalhaLote(422, `O ${nome} não tinha o lote ${alvo.codigo} em ${br(data)}. Confira o galpão e a data.`);
      }
      const ap = await substituirApontamento(tx, { organizationId: orgId, criadoPorId: userId, ocorrenciaId: null }, instalacaoId, id, data, valores);
      // A ração do dia sai do silo do galpão (ou é corrigida, se mudou).
      baixa = await sincronizarRacao(tx, { orgId, userId, instalacaoId, apontamentoId: ap.id, data, racaoKg: ap.racaoKg });
    }),
  );
  if (r.ok) {
    if (baixa.semSilo) await avisarGalpaoSemSilo(orgId, (await nomeDaInstalacao(db, orgId, instalacaoId)) ?? "galpão");
    await avisarSaldoNegativo(orgId, baixa.mexeu);
  }
  return r;
}

export async function lancarPesagem(
  orgId: string,
  userId: string,
  id: string,
  dados: z.infer<typeof pesagemLoteInputSchema>,
): Promise<Resultado<void>> {
  const alvo = await acharLote(orgId, id);
  if (!alvo) return falha(404, NAO_ENCONTRADO);
  if (dados.instalacaoId && !(await nomeDaInstalacao(db, orgId, dados.instalacaoId))) return falha(404, "Galpão não encontrado.");
  if (dados.data > hojeISO()) return falha(422, "Data no futuro.");
  if (alvo.dataEncerramento && dados.data > alvo.dataEncerramento) {
    return falha(422, `O lote ${alvo.codigo} foi encerrado em ${br(alvo.dataEncerramento)}.`);
  }

  await db.insert(pesagemLote).values({
    organizationId: orgId,
    criadoPorId: userId,
    loteId: id,
    instalacaoId: dados.instalacaoId ?? null,
    data: dados.data,
    sexo: dados.sexo,
    pesoMedioG: String(dados.pesoMedioG),
    uniformidadePct: dados.uniformidadePct == null ? null : String(dados.uniformidadePct),
    amostra: dados.amostra ?? null,
  });
  return ok(undefined);
}

export async function lancarVacinacao(
  orgId: string,
  userId: string,
  id: string,
  dados: z.infer<typeof vacinacaoLoteInputSchema>,
): Promise<Resultado<void>> {
  const alvo = await acharLote(orgId, id);
  if (!alvo) return falha(404, NAO_ENCONTRADO);
  if (dados.data > hojeISO()) return falha(422, "Data no futuro.");
  if (alvo.dataEncerramento && dados.data > alvo.dataEncerramento) {
    return falha(422, `O lote ${alvo.codigo} foi encerrado em ${br(alvo.dataEncerramento)}.`);
  }

  const linha = {
    organizationId: orgId,
    criadoPorId: userId,
    loteId: id,
    vacina: dados.vacina,
    via: dados.via ?? null,
    data: dados.data,
    proximaData: dados.proximaData ?? null,
  };
  if (!dados.produtoId) {
    await db.insert(vacinacaoLote).values(linha);
    return ok(undefined);
  }

  // Com produto do estoque: as doses saem de lá (padrão: as aves vivas no dia).
  const produtoId = dados.produtoId;
  const quantidade = dados.quantidade ?? (await avesVivasNoDia(alvo, dados.data));
  if (quantidade <= 0) return falha(422, "O lote não tem aves vivas nessa data.");
  let mexeu: { produtoId: string; localId: string }[] = [];
  const r = await capturar(() =>
    db.transaction(async (tx) => {
      const [v] = await tx
        .insert(vacinacaoLote)
        .values({ ...linha, produtoId, quantidade: String(quantidade) })
        .returning({ id: vacinacaoLote.id });
      const b = await baixarInsumo(tx, {
        orgId,
        userId,
        origemTipo: "vacinacao_lote",
        origemId: v!.id,
        data: dados.data,
        produtoId,
        localId: dados.localId,
        quantidade,
        loteFabricacao: dados.loteFabricacao,
        categorias: ["vacina", "medicamento"],
      });
      if (!b.ok) throw new FalhaLote(b.status === 400 || b.status === 404 || b.status === 409 ? b.status : 422, b.erro);
      mexeu = [b.valor];
    }),
  );
  if (r.ok) await avisarSaldoNegativo(orgId, mexeu);
  return r;
}
