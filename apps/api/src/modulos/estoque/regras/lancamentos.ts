import { arredondar, type saidaInputSchema, type transferenciaInputSchema } from "@vocare/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { movimentoEstoque, saldoEstoque } from "../../../db/tabelas/estoque";
import { unicoViolado } from "./falha";
import { estornarMovimento, lancarMovimento, sairPorFefo } from "./movimento";
import { avisarSaldoNegativo } from "./negativo";
import { conferirData, conferirLocal, conferirProduto } from "./validar";

/** Saldo do produto no local (de um lote, se informado). */
async function saldoNoLocal(produtoId: string, localId: string, lote?: string | null): Promise<number> {
  const w = [eq(saldoEstoque.produtoId, produtoId), eq(saldoEstoque.localId, localId)];
  if (lote != null) w.push(eq(saldoEstoque.loteFabricacao, lote));
  const [s] = await db
    .select({ q: sql<string>`coalesce(sum(${saldoEstoque.quantidade}), 0)` })
    .from(saldoEstoque)
    .where(and(...w));
  return arredondar(Number(s?.q ?? 0), 3);
}

export type ResultadoSaida = { ids: string[] } | { confirmar: true; saldo: number };

/**
 * Saída manual. Acima do saldo, devolve `confirmar` (a tela pergunta); com
 * `confirmarNegativo`, lança mesmo assim e o saldo fica negativo.
 */
export async function lancarSaida(orgId: string, userId: string, dados: z.infer<typeof saidaInputSchema>): Promise<Resultado<ResultadoSaida>> {
  const data = conferirData(dados.data);
  if (!data.ok) return data;
  const p = await conferirProduto(db, orgId, dados.produtoId);
  if (!p.ok) return p;
  const l = await conferirLocal(db, orgId, dados.localId);
  if (!l.ok) return l;

  const saldo = await saldoNoLocal(dados.produtoId, dados.localId, dados.loteFabricacao);
  if (!dados.confirmarNegativo && arredondar(dados.quantidade, 3) > saldo) return ok({ confirmar: true, saldo });

  const ids = await db.transaction((tx) =>
    sairPorFefo(tx, {
      orgId,
      userId,
      produtoId: dados.produtoId,
      localId: dados.localId,
      quantidade: dados.quantidade,
      data: dados.data,
      origemTipo: "manual",
      motivo: dados.motivo ?? null,
      loteFabricacao: dados.loteFabricacao ?? undefined,
    }),
  );
  await avisarSaldoNegativo(orgId, [{ produtoId: dados.produtoId, localId: dados.localId }]);
  return ok({ ids });
}

/** Sai de um local e entra no outro, com o mesmo lote e custo, na mesma transação. */
export async function lancarTransferencia(
  orgId: string,
  userId: string,
  dados: z.infer<typeof transferenciaInputSchema>,
): Promise<Resultado<string[]>> {
  const data = conferirData(dados.data);
  if (!data.ok) return data;
  const p = await conferirProduto(db, orgId, dados.produtoId);
  if (!p.ok) return p;
  for (const localId of [dados.deLocalId, dados.paraLocalId]) {
    const l = await conferirLocal(db, orgId, localId);
    if (!l.ok) return l;
  }

  const grupoId = crypto.randomUUID();
  const ids = await db.transaction(async (tx) => {
    const saidas = await sairPorFefo(tx, {
      orgId,
      userId,
      produtoId: dados.produtoId,
      localId: dados.deLocalId,
      quantidade: dados.quantidade,
      tipo: "transferencia",
      data: dados.data,
      origemTipo: "transferencia",
      grupoId,
      loteFabricacao: dados.loteFabricacao ?? undefined,
    });
    const lados = await tx.select().from(movimentoEstoque).where(inArray(movimentoEstoque.id, saidas));
    const entradas: string[] = [];
    for (const s of lados) {
      const { id } = await lancarMovimento(tx, {
        orgId,
        userId,
        produtoId: s.produtoId,
        localId: dados.paraLocalId,
        tipo: "transferencia",
        quantidade: -Number(s.quantidade),
        custoUnitario: Number(s.custoUnitario),
        loteFabricacao: s.loteFabricacao,
        validade: s.validade,
        data: dados.data,
        origemTipo: "transferencia",
        grupoId,
      });
      entradas.push(id);
    }
    return [...saidas, ...entradas];
  });
  await avisarSaldoNegativo(orgId, [{ produtoId: dados.produtoId, localId: dados.deLocalId }]);
  return ok(ids);
}

/** Estorno pedido pelo livro; o segundo pedido simultâneo cai no índice único e vira 409. */
export async function estornar(orgId: string, userId: string, movimentoId: string, motivo: string): Promise<Resultado<string[]>> {
  let r: Resultado<string[]>;
  try {
    r = await db.transaction(async (tx) => {
      const feito = await estornarMovimento(tx, orgId, userId, movimentoId, motivo);
      return feito;
    });
  } catch (e) {
    if (unicoViolado(e) !== null) return falha(409, "Este movimento já foi estornado.");
    throw e;
  }
  if (r.ok) {
    const afetados = await db
      .select({ produtoId: movimentoEstoque.produtoId, localId: movimentoEstoque.localId })
      .from(movimentoEstoque)
      .where(inArray(movimentoEstoque.id, r.valor));
    await avisarSaldoNegativo(orgId, afetados);
  }
  return r;
}
