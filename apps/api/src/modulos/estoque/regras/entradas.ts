import { arredondar, converterParaUnidade, type entradaManualSchema, type OrigemEntrada } from "@vocare/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { entrada, fornecedor, movimentoEstoque } from "../../../db/tabelas/estoque";
import { unicoViolado } from "./falha";
import { estornarMovimento, lancarMovimento } from "./movimento";
import { avisarSaldoNegativo } from "./negativo";
import { conferirData, conferirLocal, conferirProduto } from "./validar";

type EntradaManual = z.infer<typeof entradaManualSchema>;

/**
 * Lança uma compra: o documento (`entrada`) e um movimento por item, em
 * unidade de estoque (quantidade × fator). Custo unitário = valor do item ÷
 * quantidade em unidade de estoque; item sem valor não mexe no custo médio.
 */
export async function lancarEntradaManual(
  orgId: string,
  userId: string,
  dados: EntradaManual,
  origem: OrigemEntrada = "tela",
  ocorrenciaId: string | null = null,
): Promise<Resultado<string>> {
  const data = conferirData(dados.data);
  if (!data.ok) return data;

  if (dados.fornecedorId) {
    const [f] = await db
      .select({ id: fornecedor.id })
      .from(fornecedor)
      .where(and(eq(fornecedor.id, dados.fornecedorId), eq(fornecedor.organizationId, orgId)));
    if (!f) return falha(404, "Fornecedor não encontrado.");
  }

  for (const item of dados.itens) {
    const p = await conferirProduto(db, orgId, item.produtoId);
    if (!p.ok) return p;
    const l = await conferirLocal(db, orgId, item.localId);
    if (!l.ok) return l;
    if (p.valor.controlaLote && (!item.loteFabricacao || !item.validade)) return falha(400, "Informe o lote e a validade.");
  }

  const comValor = dados.itens.filter((i) => i.custoTotal != null);
  const valorTotal = comValor.length ? String(arredondar(comValor.reduce((t, i) => t + (i.custoTotal ?? 0), 0), 2)) : null;

  const id = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(entrada)
      .values({
        organizationId: orgId,
        criadoPorId: userId,
        fornecedorId: dados.fornecedorId ?? null,
        numeroNota: dados.numeroNota ?? null,
        serie: dados.serie ?? null,
        data: dados.data,
        valorTotal,
        origem,
        ocorrenciaId,
      })
      .returning({ id: entrada.id });

    for (const item of dados.itens) {
      const quantidade = converterParaUnidade(item.quantidade, item.fator);
      await lancarMovimento(tx, {
        orgId,
        userId,
        produtoId: item.produtoId,
        localId: item.localId,
        tipo: "entrada",
        quantidade,
        custoUnitario: item.custoTotal ? item.custoTotal / quantidade : undefined,
        loteFabricacao: item.loteFabricacao ?? "",
        validade: item.validade ?? null,
        data: dados.data,
        origemTipo: "entrada",
        origemId: doc!.id,
        ocorrenciaId,
      });
    }
    return doc!.id;
  });
  return ok(id);
}

/** Estorna todos os itens da entrada (o custo médio é refeito) e marca a entrada como estornada. */
export async function estornarEntrada(orgId: string, userId: string, id: string, motivo: string): Promise<Resultado<string>> {
  const [doc] = await db
    .select()
    .from(entrada)
    .where(and(eq(entrada.id, id), eq(entrada.organizationId, orgId)));
  if (!doc) return falha(404, "Entrada não encontrada.");
  if (doc.estornadaEm) return falha(409, "Esta entrada já foi estornada.");

  const itens = await db
    .select({ id: movimentoEstoque.id, produtoId: movimentoEstoque.produtoId, localId: movimentoEstoque.localId })
    .from(movimentoEstoque)
    .where(and(eq(movimentoEstoque.origemTipo, "entrada"), eq(movimentoEstoque.origemId, id), eq(movimentoEstoque.tipo, "entrada")));

  try {
    await db.transaction(async (tx) => {
      const [marcada] = await tx
        .update(entrada)
        .set({ estornadaEm: new Date() })
        .where(and(eq(entrada.id, id), isNull(entrada.estornadaEm)))
        .returning({ id: entrada.id });
      if (!marcada) throw new EntradaJaEstornada();
      for (const item of itens) {
        // Item já estornado sozinho (pelo livro) fica como está.
        await estornarMovimento(tx, orgId, userId, item.id, motivo);
      }
    });
  } catch (e) {
    if (e instanceof EntradaJaEstornada || unicoViolado(e) !== null) return falha(409, "Esta entrada já foi estornada.");
    throw e;
  }
  await avisarSaldoNegativo(orgId, itens);
  return ok(id);
}

class EntradaJaEstornada extends Error {}
