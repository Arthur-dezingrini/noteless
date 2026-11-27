import { and, eq, gte, sql } from "drizzle-orm";

import { hojeISO } from "../../../base/datas";
import { db } from "../../../db";
import { notificacao } from "../../../db/tabelas/avisos";
import { localEstoque, produto, saldoEstoque } from "../../../db/tabelas/estoque";
import { administradores, notificar } from "../../avisos";

/** Meia-noite de hoje em São Paulo (sem horário de verão desde 2019). */
export const inicioDoDia = (hoje = hojeISO()) => new Date(`${hoje}T00:00:00-03:00`);

/** Avisa os administradores, a não ser que o mesmo texto já tenha sido avisado hoje nesta organização. */
export async function notificarNoDia(orgId: string, aviso: { texto: string; detalhe: string; link: string }): Promise<boolean> {
  const [ja] = await db
    .select({ id: notificacao.id })
    .from(notificacao)
    .where(and(eq(notificacao.organizationId, orgId), eq(notificacao.texto, aviso.texto), gte(notificacao.createdAt, inicioDoDia())))
    .limit(1);
  if (ja) return false;
  await notificar(orgId, await administradores(orgId), aviso);
  return true;
}

/**
 * Avisa os administradores de cada produto × local que ficou com saldo
 * negativo. Chamada depois do commit: aviso de lançamento desfeito não sai.
 */
export async function avisarSaldoNegativo(orgId: string, itens: { produtoId: string; localId: string }[]): Promise<void> {
  const unicos = [...new Map(itens.map((i) => [`${i.produtoId}|${i.localId}`, i])).values()];
  if (unicos.length === 0) return;

  const negativos: string[] = [];
  for (const { produtoId, localId } of unicos) {
    const [s] = await db
      .select({ total: sql<string>`sum(${saldoEstoque.quantidade})`, produto: produto.nome, local: localEstoque.nome })
      .from(saldoEstoque)
      .innerJoin(produto, eq(produto.id, saldoEstoque.produtoId))
      .innerJoin(localEstoque, eq(localEstoque.id, saldoEstoque.localId))
      .where(and(eq(saldoEstoque.organizationId, orgId), eq(saldoEstoque.produtoId, produtoId), eq(saldoEstoque.localId, localId)))
      .groupBy(produto.nome, localEstoque.nome);
    if (s && Number(s.total) < 0) negativos.push(`Saldo negativo: ${s.produto} em ${s.local}`);
  }
  if (negativos.length === 0) return;

  for (const texto of negativos) await notificarNoDia(orgId, { texto, detalhe: "Falta lançar uma entrada?", link: "/estoque" });
}

/** Ração lançada no registro diário que não saiu do estoque: o galpão não tem silo ligado, ou o silo nunca recebeu ração. */
export async function avisarGalpaoSemSilo(orgId: string, nomeGalpao: string): Promise<void> {
  await notificarNoDia(orgId, {
    texto: `Ração do ${nomeGalpao} não saiu do estoque`,
    detalhe: "Ligue um silo ao galpão e lance a entrada da ração.",
    link: "/estoque/locais",
  });
}
