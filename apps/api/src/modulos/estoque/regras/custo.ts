import { novoCustoMedio } from "@vocare/shared";
import { and, asc, eq, isNotNull } from "drizzle-orm";

import { movimentoEstoque, produto } from "../../../db/tabelas/estoque";
import type { Tx } from "./movimento";

/**
 * Refaz o custo médio do produto relendo o livro em ordem, sem os movimentos
 * estornados nem os estornos (um anula o outro). Usado quando uma entrada é
 * estornada: desfazer a fórmula de trás para frente não fecha com arredondamento.
 */
export async function recalcularCustoMedio(tx: Tx, produtoId: string): Promise<void> {
  const estornados = await tx
    .select({ id: movimentoEstoque.estornaId })
    .from(movimentoEstoque)
    .where(and(eq(movimentoEstoque.produtoId, produtoId), isNotNull(movimentoEstoque.estornaId)));
  const fora = new Set(estornados.map((e) => e.id));

  const livro = await tx
    .select({ id: movimentoEstoque.id, tipo: movimentoEstoque.tipo, quantidade: movimentoEstoque.quantidade, custo: movimentoEstoque.custoUnitario })
    .from(movimentoEstoque)
    .where(eq(movimentoEstoque.produtoId, produtoId))
    .orderBy(asc(movimentoEstoque.createdAt), asc(movimentoEstoque.id));

  let saldo = 0;
  let custo = 0;
  for (const m of livro) {
    if (m.tipo === "estorno" || fora.has(m.id)) continue;
    const qtd = Number(m.quantidade);
    const cu = Number(m.custo);
    if (m.tipo === "entrada" && qtd > 0 && cu > 0) custo = novoCustoMedio(saldo, custo, qtd, cu);
    saldo += qtd;
  }
  await tx.update(produto).set({ custoMedio: String(custo) }).where(eq(produto.id, produtoId));
}
