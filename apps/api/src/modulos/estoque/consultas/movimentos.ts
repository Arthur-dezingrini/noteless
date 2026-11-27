import type { Movimento, OrigemMovimento, PaginaMovimentos, TipoMovimento, UnidadeEstoque } from "@vocare/shared";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { user } from "../../../db/schema";
import { localEstoque, movimentoEstoque, produto } from "../../../db/tabelas/estoque";

export const POR_PAGINA = 50;

export type FiltroMovimentos = {
  produtoId?: string;
  localId?: string;
  de?: string;
  ate?: string;
  origemTipo?: string;
  loteFabricacao?: string;
  criadoPorId?: string;
  ids?: string[];
  /** Itens de entradas: movimentos `entrada` com estas origens. */
  entradaIds?: string[];
};

const estornado = sql<boolean>`exists (select 1 from "movimento_estoque" as e where e."estorna_id" = "movimento_estoque"."id")`;

async function buscar(orgId: string, filtro: FiltroMovimentos, verCusto: boolean, limite?: number, pular = 0): Promise<Movimento[]> {
  const w: SQL[] = [eq(movimentoEstoque.organizationId, orgId)];
  if (filtro.produtoId) w.push(eq(movimentoEstoque.produtoId, filtro.produtoId));
  if (filtro.localId) w.push(eq(movimentoEstoque.localId, filtro.localId));
  if (filtro.de) w.push(gte(movimentoEstoque.data, filtro.de));
  if (filtro.ate) w.push(lte(movimentoEstoque.data, filtro.ate));
  if (filtro.origemTipo) w.push(eq(movimentoEstoque.origemTipo, filtro.origemTipo));
  if (filtro.loteFabricacao !== undefined) w.push(eq(movimentoEstoque.loteFabricacao, filtro.loteFabricacao));
  if (filtro.criadoPorId) w.push(eq(movimentoEstoque.criadoPorId, filtro.criadoPorId));
  if (filtro.ids) w.push(inArray(movimentoEstoque.id, filtro.ids.length ? filtro.ids : [""]));
  if (filtro.entradaIds) {
    w.push(eq(movimentoEstoque.origemTipo, "entrada"), eq(movimentoEstoque.tipo, "entrada"));
    w.push(inArray(movimentoEstoque.origemId, filtro.entradaIds.length ? filtro.entradaIds : [""]));
  }

  let q = db
    .select({ m: movimentoEstoque, produtoNome: produto.nome, unidade: produto.unidade, localNome: localEstoque.nome, criadoPorNome: user.name, estornado })
    .from(movimentoEstoque)
    .innerJoin(produto, eq(produto.id, movimentoEstoque.produtoId))
    .innerJoin(localEstoque, eq(localEstoque.id, movimentoEstoque.localId))
    .leftJoin(user, eq(user.id, movimentoEstoque.criadoPorId))
    .where(and(...w))
    .orderBy(desc(movimentoEstoque.createdAt), desc(movimentoEstoque.id))
    .$dynamic();
  if (limite !== undefined) q = q.limit(limite).offset(pular);

  return (await q).map(({ m, produtoNome, unidade, localNome, criadoPorNome, estornado: foi }) => ({
    id: m.id,
    produtoId: m.produtoId,
    produtoNome,
    unidade: unidade as UnidadeEstoque,
    localId: m.localId,
    localNome,
    loteFabricacao: m.loteFabricacao,
    validade: m.validade,
    tipo: m.tipo as TipoMovimento,
    quantidade: Number(m.quantidade),
    ...(verCusto ? { custoUnitario: Number(m.custoUnitario) } : {}),
    data: m.data,
    origemTipo: m.origemTipo as OrigemMovimento,
    origemId: m.origemId,
    grupoId: m.grupoId,
    estornaId: m.estornaId,
    estornado: Boolean(foi),
    motivo: m.motivo,
    criadoPorNome: criadoPorNome ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
}

/** O livro, mais recentes primeiro, `POR_PAGINA` por página. */
export async function listarMovimentos(orgId: string, filtro: FiltroMovimentos, verCusto: boolean, pagina = 1): Promise<PaginaMovimentos> {
  const itens = await buscar(orgId, filtro, verCusto, POR_PAGINA + 1, (pagina - 1) * POR_PAGINA);
  return { itens: itens.slice(0, POR_PAGINA), temMais: itens.length > POR_PAGINA };
}

export function movimentosPorIds(orgId: string, ids: string[], verCusto: boolean): Promise<Movimento[]> {
  return buscar(orgId, { ids }, verCusto);
}

export function itensDasEntradas(orgId: string, entradaIds: string[], verCusto: boolean): Promise<Movimento[]> {
  return buscar(orgId, { entradaIds }, verCusto);
}
