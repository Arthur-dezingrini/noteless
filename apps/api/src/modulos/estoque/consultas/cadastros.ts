import type { CategoriaProduto, Fornecedor, Local, Produto, TipoLocal, UnidadeEstoque } from "@vocare/shared";
import { and, asc, eq, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { instalacao } from "../../../db/tabelas/aviario";
import { fornecedor, localEstoque, produto } from "../../../db/tabelas/estoque";

const numeroOuNulo = (v: string | null) => (v == null ? null : Number(v));

export type LinhaProduto = typeof produto.$inferSelect;

/** Produto como a api devolve; `custoMedio` só para quem pode ver custo. */
export function paraProduto(p: LinhaProduto, verCusto: boolean): Produto {
  return {
    id: p.id,
    nome: p.nome,
    categoria: p.categoria as CategoriaProduto,
    unidade: p.unidade as UnidadeEstoque,
    embalagemNome: p.embalagemNome,
    embalagemFator: numeroOuNulo(p.embalagemFator),
    estoqueMinimo: numeroOuNulo(p.estoqueMinimo),
    controlaLote: p.controlaLote,
    ativo: p.ativo,
    ...(verCusto ? { custoMedio: Number(p.custoMedio) } : {}),
  };
}

export async function listarProdutos(orgId: string, verCusto: boolean, id?: string): Promise<Produto[]> {
  const filtros: SQL[] = [eq(produto.organizationId, orgId)];
  if (id) filtros.push(eq(produto.id, id));
  const rows = await db.select().from(produto).where(and(...filtros)).orderBy(asc(produto.nome));
  return rows.map((p) => paraProduto(p, verCusto));
}

export async function listarLocais(orgId: string, id?: string): Promise<Local[]> {
  const filtros: SQL[] = [eq(localEstoque.organizationId, orgId)];
  if (id) filtros.push(eq(localEstoque.id, id));
  const rows = await db
    .select({ l: localEstoque, instalacaoNome: instalacao.nome })
    .from(localEstoque)
    .leftJoin(instalacao, eq(instalacao.id, localEstoque.instalacaoId))
    .where(and(...filtros))
    .orderBy(asc(localEstoque.nome));
  return rows.map(({ l, instalacaoNome }) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo as TipoLocal,
    instalacaoId: l.instalacaoId,
    instalacaoNome: instalacaoNome ?? null,
    ativo: l.ativo,
  }));
}

export async function listarFornecedores(orgId: string, id?: string): Promise<Fornecedor[]> {
  const filtros: SQL[] = [eq(fornecedor.organizationId, orgId)];
  if (id) filtros.push(eq(fornecedor.id, id));
  const rows = await db.select().from(fornecedor).where(and(...filtros)).orderBy(asc(fornecedor.nome));
  return rows.map((f) => ({ id: f.id, nome: f.nome, documento: f.documento, telefone: f.telefone }));
}
