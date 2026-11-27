import type { Operacao } from "@vocare/shared";
import { and, eq, sql } from "drizzle-orm";

import { entrada, fornecedor } from "../../../db/tabelas/estoque";
import { lancarMovimento, sairPorFefo, type Tx } from "./movimento";
import { conferirData, conferirLocal, conferirProduto } from "./validar";

export type ContextoNota = { orgId: string; userId: string; ocorrenciaId: string; indice: number; data: string };

/**
 * Aplica entrada_estoque / saida_estoque de uma nota confirmada, na
 * transação da confirmação. Devolve a mensagem do que falta, ou null —
 * o mesmo contrato de `aplicarAviario`.
 */
export async function aplicarEstoque(tx: Tx, op: Operacao, ctx: ContextoNota): Promise<string | null> {
  if (op.tipo !== "entrada_estoque" && op.tipo !== "saida_estoque") return "Operação do estoque desconhecida.";
  if (!op.produtoId || !op.localId) return "Escolha o produto e o local do estoque.";
  if (op.quantidade == null) return "Informe a quantidade.";
  const data = op.data ?? ctx.data;
  const d = conferirData(data);
  if (!d.ok) return d.erro;
  const p = await conferirProduto(tx, ctx.orgId, op.produtoId);
  if (!p.ok) return p.erro;
  const l = await conferirLocal(tx, ctx.orgId, op.localId);
  if (!l.ok) return l.erro;
  const origemId = `${ctx.ocorrenciaId}:${ctx.indice}`;

  if (op.tipo === "saida_estoque") {
    await sairPorFefo(tx, {
      orgId: ctx.orgId,
      userId: ctx.userId,
      produtoId: op.produtoId,
      localId: op.localId,
      quantidade: op.quantidade,
      data,
      origemTipo: "ocorrencia",
      origemId,
      motivo: op.motivo,
      ocorrenciaId: ctx.ocorrenciaId,
    });
    return null;
  }

  if (p.valor.controlaLote && (!op.loteFabricacao || !op.validade)) return "Informe o lote e a validade.";
  // Fornecedor dito só entra se bate com um do cadastro (sem diferenciar maiúsculas).
  const [forn] = op.fornecedor
    ? await tx
        .select({ id: fornecedor.id })
        .from(fornecedor)
        .where(and(eq(fornecedor.organizationId, ctx.orgId), sql`lower(${fornecedor.nome}) = lower(${op.fornecedor})`))
        .limit(1)
    : [];
  const [doc] = await tx
    .insert(entrada)
    .values({
      organizationId: ctx.orgId,
      criadoPorId: ctx.userId,
      fornecedorId: forn?.id ?? null,
      numeroNota: op.numeroNota,
      data,
      valorTotal: op.valorTotal == null ? null : String(op.valorTotal),
      origem: "voz",
      ocorrenciaId: ctx.ocorrenciaId,
    })
    .returning({ id: entrada.id });
  await lancarMovimento(tx, {
    orgId: ctx.orgId,
    userId: ctx.userId,
    produtoId: op.produtoId,
    localId: op.localId,
    tipo: "entrada",
    quantidade: op.quantidade,
    custoUnitario: op.valorTotal ? op.valorTotal / op.quantidade : undefined,
    loteFabricacao: op.loteFabricacao ?? "",
    validade: op.validade,
    data,
    origemTipo: "entrada",
    origemId: doc!.id,
    ocorrenciaId: ctx.ocorrenciaId,
  });
  return null;
}
