import type { criarLoteSchema, FaseLote, transferirLoteSchema } from "@vocare/shared";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import type { z } from "zod";

import { br, hojeISO, noDia } from "../../../base/datas";
import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { alojamento, apontamentoAviario, instalacao, lote, pesagemLote } from "../../../db/tabelas/aviario";
import { acharLote } from "../consultas/lotes";
import { nomeDaInstalacao, sobrepoe } from "./alojamento";
import { capturar, FalhaLote, nomeRepetido } from "./falha";

const CODIGO_REPETIDO = "Já existe um lote com esse código.";
const NAO_ENCONTRADO = "Lote não encontrado.";

/** Cria o lote e um alojamento por galpão, numa transação. */
export async function criarLote(orgId: string, userId: string, dados: z.infer<typeof criarLoteSchema>): Promise<Resultado<{ id: string }>> {
  if (dados.dataAlojamento > hojeISO()) return falha(422, "Data no futuro.");
  try {
    return await capturar(() =>
      db.transaction(async (tx) => {
        const [novo] = await tx
          .insert(lote)
          .values({
            organizationId: orgId,
            criadoPorId: userId,
            codigo: dados.codigo,
            especie: dados.especie,
            linhagem: dados.linhagem ?? null,
            dataAlojamento: dados.dataAlojamento,
            idadeAlojamentoDias: dados.idadeAlojamentoDias,
            femeasIniciais: dados.galpoes.reduce((s, g) => s + g.femeas, 0),
            machosIniciais: dados.galpoes.reduce((s, g) => s + g.machos, 0),
            fase: dados.fase,
          })
          .returning({ id: lote.id });
        for (const g of dados.galpoes) {
          const nome = await nomeDaInstalacao(tx, orgId, g.instalacaoId);
          if (!nome) throw new FalhaLote(404, "Galpão não encontrado.");
          if (await sobrepoe(tx, g.instalacaoId, dados.dataAlojamento, null)) {
            throw new FalhaLote(409, `O ${nome} já tem lote alojado nesse período.`);
          }
          await tx.insert(alojamento).values({
            organizationId: orgId,
            criadoPorId: userId,
            loteId: novo!.id,
            instalacaoId: g.instalacaoId,
            inicio: dados.dataAlojamento,
            femeas: g.femeas,
            machos: g.machos,
          });
        }
        return { id: novo!.id };
      }),
    );
  } catch (e) {
    if (nomeRepetido(e)) return falha(409, CODIGO_REPETIDO);
    throw e;
  }
}

/** Fecha o alojamento de origem na véspera e abre o de destino em `data`. */
export async function transferirLote(
  orgId: string,
  userId: string,
  id: string,
  { data, de, para, femeas, machos }: z.infer<typeof transferirLoteSchema>,
): Promise<Resultado<void>> {
  if (!(await acharLote(orgId, id))) return falha(404, NAO_ENCONTRADO);
  if (de === para) return falha(422, "Escolha um galpão de destino diferente do de origem.");
  if (data > hojeISO()) return falha(422, "Data no futuro.");

  return capturar(() =>
    db.transaction(async (tx) => {
      const nomeDestino = await nomeDaInstalacao(tx, orgId, para);
      if (!nomeDestino) throw new FalhaLote(404, "Galpão de destino não encontrado.");
      const [aberto] = await tx
        .select()
        .from(alojamento)
        .where(and(eq(alojamento.loteId, id), eq(alojamento.instalacaoId, de), isNull(alojamento.fim)));
      if (!aberto) throw new FalhaLote(422, "Este lote não está alojado no galpão de origem. Confira o galpão escolhido.");
      if (data <= aberto.inicio) {
        throw new FalhaLote(422, "A data da transferência deve ser depois do início do alojamento no galpão de origem.");
      }
      if (await sobrepoe(tx, para, data, null)) {
        throw new FalhaLote(409, `O ${nomeDestino} já tem lote alojado nesse período.`);
      }
      // A transferência leva todas as aves do galpão: não passa do que está vivo lá.
      const baixas = await tx
        .select()
        .from(apontamentoAviario)
        .where(and(eq(apontamentoAviario.instalacaoId, de), gte(apontamentoAviario.data, aberto.inicio), lt(apontamentoAviario.data, data)));
      const soma = (f: (l: (typeof baixas)[number]) => number | null) => baixas.reduce((t, l) => t + (f(l) ?? 0), 0);
      const vivasF = aberto.femeas - soma((l) => (l.mortasFemeas ?? 0) + (l.eliminadasFemeas ?? 0));
      const vivasM = aberto.machos - soma((l) => (l.mortasMachos ?? 0) + (l.eliminadasMachos ?? 0));
      if (femeas > vivasF || machos > vivasM) {
        const nomeOrigem = (await nomeDaInstalacao(tx, orgId, de)) ?? "galpão de origem";
        throw new FalhaLote(
          422,
          `O ${nomeOrigem} tem ${vivasF} fêmeas e ${vivasM} machos vivos; não dá para transferir mais que isso.`,
        );
      }
      await tx.update(alojamento).set({ fim: noDia(data, -1) }).where(eq(alojamento.id, aberto.id));
      await tx.insert(alojamento).values({
        organizationId: orgId,
        criadoPorId: userId,
        loteId: id,
        instalacaoId: para,
        inicio: data,
        femeas,
        machos,
      });
    }),
  );
}

export async function mudarFase(orgId: string, id: string, fase: FaseLote): Promise<Resultado<void>> {
  const alvo = await db
    .update(lote)
    .set({ fase })
    .where(and(eq(lote.id, id), eq(lote.organizationId, orgId)))
    .returning({ id: lote.id });
  return alvo.length === 0 ? falha(404, NAO_ENCONTRADO) : ok(undefined);
}

/** Encerra o lote em `data` e fecha os alojamentos abertos no mesmo dia. */
export async function encerrarLote(orgId: string, id: string, data: string): Promise<Resultado<void>> {
  const alvo = await acharLote(orgId, id);
  if (!alvo) return falha(404, NAO_ENCONTRADO);
  if (data > hojeISO()) return falha(422, "Data no futuro.");
  if (data < alvo.dataAlojamento) return falha(422, "A data de encerramento não pode ser antes do alojamento do lote.");
  if (alvo.situacao === "encerrado") {
    return falha(422, `Este lote já foi encerrado em ${br(alvo.dataEncerramento ?? alvo.dataAlojamento)}.`);
  }
  const abertos = await db
    .select({ inicio: alojamento.inicio, nome: instalacao.nome })
    .from(alojamento)
    .innerJoin(instalacao, eq(instalacao.id, alojamento.instalacaoId))
    .where(and(eq(alojamento.loteId, id), isNull(alojamento.fim)));
  const recente = abertos.filter((a) => data < a.inicio).sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
  if (recente) {
    return falha(422, `A data de encerramento não pode ser antes de ${br(recente.inicio)}, quando o lote entrou no ${recente.nome}.`);
  }
  await db.transaction(async (tx) => {
    await tx.update(lote).set({ situacao: "encerrado", dataEncerramento: data }).where(eq(lote.id, id));
    await tx.update(alojamento).set({ fim: data }).where(and(eq(alojamento.loteId, id), isNull(alojamento.fim)));
  });
  return ok(undefined);
}

/**
 * Desfaz a última transferência: apaga o alojamento de destino e reabre o de
 * origem (o que terminou no dia anterior). Uma por chamada. Recusa se o
 * destino já tem lançamento depois da transferência — desfazer apagaria a
 * história — ou se a origem já recebeu outro lote.
 */
export async function desfazerTransferencia(orgId: string, id: string): Promise<Resultado<void>> {
  const alvo = await acharLote(orgId, id);
  if (!alvo) return falha(404, NAO_ENCONTRADO);
  if (alvo.situacao === "encerrado") return falha(422, "Reabra o lote antes de desfazer a transferência.");

  return capturar(() =>
    db.transaction(async (tx) => {
      const todos = await tx.select().from(alojamento).where(eq(alojamento.loteId, id));
      const abertos = todos.filter((a) => a.fim === null).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
      let par: { destino: (typeof todos)[number]; origem: (typeof todos)[number] } | null = null;
      for (const destino of abertos) {
        const origem = todos.find((a) => a.fim === noDia(destino.inicio, -1));
        if (origem) {
          par = { destino, origem };
          break;
        }
      }
      if (!par) throw new FalhaLote(422, "Este lote não tem transferência para desfazer.");
      const { destino, origem } = par;

      const [apontado] = await tx
        .select({ id: apontamentoAviario.id })
        .from(apontamentoAviario)
        .where(and(eq(apontamentoAviario.instalacaoId, destino.instalacaoId), eq(apontamentoAviario.loteId, id), gte(apontamentoAviario.data, destino.inicio)))
        .limit(1);
      const [pesado] = await tx
        .select({ id: pesagemLote.id })
        .from(pesagemLote)
        .where(and(eq(pesagemLote.instalacaoId, destino.instalacaoId), eq(pesagemLote.loteId, id), gte(pesagemLote.data, destino.inicio)))
        .limit(1);
      if (apontado || pesado) {
        const nome = (await nomeDaInstalacao(tx, orgId, destino.instalacaoId)) ?? "galpão de destino";
        throw new FalhaLote(
          422,
          `O ${nome} já tem apontamento ou pesagem depois da transferência. Apague ou corrija esses lançamentos antes de desfazer.`,
        );
      }
      if (await sobrepoe(tx, origem.instalacaoId, origem.inicio, null, origem.id)) {
        const nome = (await nomeDaInstalacao(tx, orgId, origem.instalacaoId)) ?? "galpão de origem";
        throw new FalhaLote(422, `O ${nome} já recebeu outro lote depois da transferência.`);
      }
      await tx.delete(alojamento).where(eq(alojamento.id, destino.id));
      await tx.update(alojamento).set({ fim: null }).where(eq(alojamento.id, origem.id));
    }),
  );
}

/** Desfaz o encerramento: lote volta a ativo e os alojamentos fechados no dia reabrem. */
export async function reabrirLote(orgId: string, id: string): Promise<Resultado<void>> {
  const alvo = await acharLote(orgId, id);
  if (!alvo) return falha(404, NAO_ENCONTRADO);
  if (alvo.situacao !== "encerrado" || !alvo.dataEncerramento) return falha(422, "Este lote não está encerrado.");
  const encerramento = alvo.dataEncerramento;

  return capturar(() =>
    db.transaction(async (tx) => {
      const fechados = await tx
        .select()
        .from(alojamento)
        .where(and(eq(alojamento.loteId, id), eq(alojamento.fim, encerramento)));
      for (const a of fechados) {
        if (await sobrepoe(tx, a.instalacaoId, noDia(encerramento, 1), null, a.id)) {
          const nome = (await nomeDaInstalacao(tx, orgId, a.instalacaoId)) ?? "galpão";
          throw new FalhaLote(409, `O ${nome} já recebeu outro lote depois do encerramento.`);
        }
      }
      await tx.update(lote).set({ situacao: "ativo", dataEncerramento: null }).where(eq(lote.id, id));
      await tx.update(alojamento).set({ fim: null }).where(and(eq(alojamento.loteId, id), eq(alojamento.fim, encerramento)));
    }),
  );
}
