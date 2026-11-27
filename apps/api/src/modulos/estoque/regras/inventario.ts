import { arredondar, type Contagem } from "@vocare/shared";
import { and, eq, inArray } from "drizzle-orm";

import { hojeISO } from "../../../base/datas";
import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { inventario, inventarioItem, produto, saldoEstoque } from "../../../db/tabelas/estoque";
import { unicoViolado } from "./falha";
import { lancarMovimento } from "./movimento";
import { conferirLocal } from "./validar";

const NAO_ACHOU = "Inventário não encontrado.";
const NAO_ABERTO = "Este inventário não está aberto.";

class InventarioFechado extends Error {}

async function acharInventario(orgId: string, id: string) {
  const [i] = await db
    .select()
    .from(inventario)
    .where(and(eq(inventario.id, id), eq(inventario.organizationId, orgId)));
  return i ?? null;
}

export async function abrirInventario(orgId: string, userId: string, localId: string): Promise<Resultado<string>> {
  const l = await conferirLocal(db, orgId, localId);
  if (!l.ok) return l;
  try {
    const [novo] = await db.insert(inventario).values({ organizationId: orgId, criadoPorId: userId, localId }).returning({ id: inventario.id });
    return ok(novo!.id);
  } catch (e) {
    if (unicoViolado(e) !== null) return falha(409, "Já há um inventário aberto neste local.");
    throw e;
  }
}

/** Substitui a contagem do inventário aberto. */
export async function contarInventario(orgId: string, id: string, itens: Contagem): Promise<Resultado<string>> {
  const inv = await acharInventario(orgId, id);
  if (!inv) return falha(404, NAO_ACHOU);
  if (inv.status !== "aberto") return falha(409, NAO_ABERTO);

  const chaves = new Set(itens.map((i) => `${i.produtoId}|${i.loteFabricacao}`));
  if (chaves.size !== itens.length) return falha(400, "Um produto foi contado duas vezes no mesmo lote.");
  const ids = [...new Set(itens.map((i) => i.produtoId))];
  if (ids.length) {
    const achados = await db
      .select({ id: produto.id })
      .from(produto)
      .where(and(eq(produto.organizationId, orgId), inArray(produto.id, ids)));
    if (achados.length !== ids.length) return falha(404, "Produto não encontrado.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(inventarioItem).where(eq(inventarioItem.inventarioId, id));
    if (itens.length) {
      await tx.insert(inventarioItem).values(
        itens.map((i) => ({
          inventarioId: id,
          produtoId: i.produtoId,
          loteFabricacao: i.loteFabricacao,
          quantidadeContada: String(arredondar(i.quantidadeContada, 3)),
        })),
      );
    }
  });
  return ok(id);
}

/**
 * Fecha a contagem: para cada item, grava o saldo do sistema naquela hora e
 * lança a diferença (contado − sistema) como ajuste. Produto que tinha saldo
 * no local e não foi contado não é ajustado.
 */
export async function fecharInventario(orgId: string, userId: string, id: string): Promise<Resultado<string>> {
  const inv = await acharInventario(orgId, id);
  if (!inv) return falha(404, NAO_ACHOU);
  if (inv.status !== "aberto") return falha(409, NAO_ABERTO);
  const itens = await db.select().from(inventarioItem).where(eq(inventarioItem.inventarioId, id));
  if (itens.length === 0) return falha(400, "Conte pelo menos um produto.");

  try {
    await db.transaction(async (tx) => {
      const [fechou] = await tx
        .update(inventario)
        .set({ status: "fechado", fechadoEm: new Date(), fechadoPorId: userId })
        .where(and(eq(inventario.id, id), eq(inventario.status, "aberto")))
        .returning({ id: inventario.id });
      if (!fechou) throw new InventarioFechado();

      for (const item of itens) {
        const [s] = await tx
          .select({ quantidade: saldoEstoque.quantidade, validade: saldoEstoque.validade })
          .from(saldoEstoque)
          .where(and(eq(saldoEstoque.produtoId, item.produtoId), eq(saldoEstoque.localId, inv.localId), eq(saldoEstoque.loteFabricacao, item.loteFabricacao)));
        const sistema = s ? Number(s.quantidade) : 0;
        const diferenca = arredondar(Number(item.quantidadeContada) - sistema, 3);
        if (diferenca !== 0) {
          await lancarMovimento(tx, {
            orgId,
            userId,
            produtoId: item.produtoId,
            localId: inv.localId,
            tipo: "ajuste",
            quantidade: diferenca,
            loteFabricacao: item.loteFabricacao,
            validade: s?.validade ?? null,
            data: hojeISO(),
            origemTipo: "inventario",
            origemId: id,
            motivo: "inventário",
          });
        }
        await tx.update(inventarioItem).set({ quantidadeSistema: String(sistema) }).where(eq(inventarioItem.id, item.id));
      }
    });
  } catch (e) {
    if (e instanceof InventarioFechado) return falha(409, NAO_ABERTO);
    throw e;
  }
  return ok(id);
}

export async function cancelarInventario(orgId: string, id: string): Promise<Resultado<string>> {
  const inv = await acharInventario(orgId, id);
  if (!inv) return falha(404, NAO_ACHOU);
  const [r] = await db
    .update(inventario)
    .set({ status: "cancelado" })
    .where(and(eq(inventario.id, id), eq(inventario.status, "aberto")))
    .returning({ id: inventario.id });
  return r ? ok(id) : falha(409, NAO_ABERTO);
}
