import type { pesagemLoteInputSchema, vacinacaoLoteInputSchema, valoresApontamentoSchema } from "@vocare/shared";
import type { z } from "zod";

import { br, hojeISO } from "../../../base/datas";
import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { pesagemLote, vacinacaoLote } from "../../../db/tabelas/aviario";
import { acharLote } from "../consultas/lotes";
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

  return capturar(() =>
    db.transaction(async (tx) => {
      const valida = await validarApontamento(tx, orgId, instalacaoId, data, valores, "substituir");
      if (typeof valida === "string") throw new FalhaLote(422, valida);
      if (valida.loteId !== id) {
        const nome = await nomeDaInstalacao(tx, orgId, instalacaoId);
        throw new FalhaLote(422, `O ${nome} não tinha o lote ${alvo.codigo} em ${br(data)}. Confira o galpão e a data.`);
      }
      await substituirApontamento(tx, { organizationId: orgId, criadoPorId: userId, ocorrenciaId: null }, instalacaoId, id, data, valores);
    }),
  );
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

  await db.insert(vacinacaoLote).values({
    organizationId: orgId,
    criadoPorId: userId,
    loteId: id,
    vacina: dados.vacina,
    via: dados.via ?? null,
    data: dados.data,
    proximaData: dados.proximaData ?? null,
  });
  return ok(undefined);
}
