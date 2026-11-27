import { arredondar, type Inventario, type InventarioResumo, type StatusInventario, type UnidadeEstoque } from "@vocare/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "../../../db";
import { inventario, inventarioItem, localEstoque, produto, saldoEstoque } from "../../../db/tabelas/estoque";

export async function listarInventarios(orgId: string): Promise<InventarioResumo[]> {
  const rows = await db
    .select({
      i: inventario,
      localNome: localEstoque.nome,
      contados: sql<number>`(select count(*) from "inventario_item" as it where it."inventario_id" = "inventario"."id")`,
    })
    .from(inventario)
    .innerJoin(localEstoque, eq(localEstoque.id, inventario.localId))
    .where(eq(inventario.organizationId, orgId))
    .orderBy(desc(inventario.abertoEm))
    .limit(100);
  return rows.map(({ i, localNome, contados }) => ({
    id: i.id,
    localId: i.localId,
    localNome,
    status: i.status as StatusInventario,
    abertoEm: i.abertoEm.toISOString(),
    fechadoEm: i.fechadoEm?.toISOString() ?? null,
    contados: Number(contados),
  }));
}

/**
 * Inventário com os itens. Aberto: o que o sistema tem no local junto com o
 * que já foi contado (diferença como prévia). Fechado: o saldo da hora de
 * fechar e o ajuste lançado.
 */
export async function montarInventario(orgId: string, id: string): Promise<Inventario | null> {
  const [cab] = await db
    .select({ i: inventario, localNome: localEstoque.nome })
    .from(inventario)
    .innerJoin(localEstoque, eq(localEstoque.id, inventario.localId))
    .where(and(eq(inventario.id, id), eq(inventario.organizationId, orgId)));
  if (!cab) return null;
  const { i } = cab;

  const contados = await db
    .select({ item: inventarioItem, produtoNome: produto.nome, unidade: produto.unidade })
    .from(inventarioItem)
    .innerJoin(produto, eq(produto.id, inventarioItem.produtoId))
    .where(eq(inventarioItem.inventarioId, id))
    .orderBy(asc(produto.nome), asc(inventarioItem.loteFabricacao));

  type Item = Inventario["itens"][number];
  const itens = new Map<string, Item>();
  const chave = (p: string, l: string) => `${p}|${l}`;

  if (i.status === "aberto") {
    const saldos = await db
      .select({ s: saldoEstoque, produtoNome: produto.nome, unidade: produto.unidade })
      .from(saldoEstoque)
      .innerJoin(produto, eq(produto.id, saldoEstoque.produtoId))
      .where(and(eq(saldoEstoque.localId, i.localId), sql`${saldoEstoque.quantidade} <> 0`))
      .orderBy(asc(produto.nome), asc(saldoEstoque.loteFabricacao));
    for (const { s, produtoNome, unidade } of saldos) {
      itens.set(chave(s.produtoId, s.loteFabricacao), {
        produtoId: s.produtoId,
        produtoNome,
        unidade: unidade as UnidadeEstoque,
        loteFabricacao: s.loteFabricacao,
        saldoAtual: Number(s.quantidade),
        quantidadeContada: null,
        quantidadeSistema: null,
        diferenca: null,
      });
    }
  }

  for (const { item, produtoNome, unidade } of contados) {
    const k = chave(item.produtoId, item.loteFabricacao);
    const contada = Number(item.quantidadeContada);
    const sistema = item.quantidadeSistema == null ? null : Number(item.quantidadeSistema);
    const atual = itens.get(k)?.saldoAtual ?? (i.status === "aberto" ? 0 : null);
    const base = i.status === "fechado" ? sistema : atual;
    itens.set(k, {
      produtoId: item.produtoId,
      produtoNome,
      unidade: unidade as UnidadeEstoque,
      loteFabricacao: item.loteFabricacao,
      saldoAtual: atual,
      quantidadeContada: contada,
      quantidadeSistema: sistema,
      diferenca: base == null || i.status === "cancelado" ? null : arredondar(contada - base, 3),
    });
  }

  return {
    id: i.id,
    localId: i.localId,
    localNome: cab.localNome,
    status: i.status as StatusInventario,
    abertoEm: i.abertoEm.toISOString(),
    fechadoEm: i.fechadoEm?.toISOString() ?? null,
    itens: [...itens.values()],
  };
}
