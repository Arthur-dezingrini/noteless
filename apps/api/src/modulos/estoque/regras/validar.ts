import { and, eq } from "drizzle-orm";

import { hojeISO, noDia } from "../../../base/datas";
import { falha, ok, type Resultado } from "../../../base/resultado";
import type { db } from "../../../db";
import { localEstoque, produto } from "../../../db/tabelas/estoque";
import type { Tx } from "./movimento";

type Leitor = Tx | typeof db;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" que existe no calendário e não está no futuro. */
export function conferirData(data: string): Resultado<void> {
  if (!DATA_ISO.test(data) || noDia(data, 0) !== data) return falha(400, "Data inválida.");
  if (data > hojeISO()) return falha(422, "Data no futuro.");
  return ok(undefined);
}

export async function conferirProduto(leitor: Leitor, orgId: string, id: string): Promise<Resultado<typeof produto.$inferSelect>> {
  const [p] = await leitor
    .select()
    .from(produto)
    .where(and(eq(produto.id, id), eq(produto.organizationId, orgId)));
  if (!p) return falha(404, "Produto não encontrado.");
  if (!p.ativo) return falha(400, "Produto inativo.");
  return ok(p);
}

export async function conferirLocal(leitor: Leitor, orgId: string, id: string): Promise<Resultado<typeof localEstoque.$inferSelect>> {
  const [l] = await leitor
    .select()
    .from(localEstoque)
    .where(and(eq(localEstoque.id, id), eq(localEstoque.organizationId, orgId)));
  if (!l) return falha(404, "Local não encontrado.");
  if (!l.ativo) return falha(400, "Local inativo.");
  return ok(l);
}
