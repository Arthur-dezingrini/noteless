import type { CategoriaProduto, UnidadeEstoque } from "@vocare/shared";
import { and, asc, eq } from "drizzle-orm";

import { db } from "../../../db";
import { localEstoque, produto } from "../../../db/tabelas/estoque";

export type ProdutoParaIa = {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  unidade: UnidadeEstoque;
  embalagemNome: string | null;
  embalagemFator: number | null;
};
export type LocalParaIa = { id: string; nome: string };
export type EstoqueParaIa = { produtos: ProdutoParaIa[]; locais: LocalParaIa[] };

/** Produtos e locais ativos, para a IA reconhecer o que foi dito na nota. */
export async function estoqueParaIa(orgId: string): Promise<EstoqueParaIa> {
  const [produtos, locais] = await Promise.all([
    db
      .select()
      .from(produto)
      .where(and(eq(produto.organizationId, orgId), eq(produto.ativo, true)))
      .orderBy(asc(produto.nome)),
    db
      .select({ id: localEstoque.id, nome: localEstoque.nome })
      .from(localEstoque)
      .where(and(eq(localEstoque.organizationId, orgId), eq(localEstoque.ativo, true)))
      .orderBy(asc(localEstoque.nome)),
  ]);
  return {
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria as CategoriaProduto,
      unidade: p.unidade as UnidadeEstoque,
      embalagemNome: p.embalagemNome,
      embalagemFator: p.embalagemFator == null ? null : Number(p.embalagemFator),
    })),
    locais,
  };
}
