import { and, eq, sql } from "drizzle-orm";

import { db } from "../../../db";
import { localEstoque, produto, saldoEstoque } from "../../../db/tabelas/estoque";
import { administradores, notificar } from "../../avisos";

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

  const admins = await administradores(orgId);
  for (const texto of negativos) {
    await notificar(orgId, admins, { texto, detalhe: "Falta lançar uma entrada?", link: "/estoque" });
  }
}
