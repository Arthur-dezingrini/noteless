import type { Entrada, OrigemEntrada } from "@vocare/shared";
import { and, desc, eq, type SQL } from "drizzle-orm";

import { db } from "../../../db";
import { entrada, fornecedor } from "../../../db/tabelas/estoque";
import { itensDasEntradas } from "./movimentos";

/** Entradas (compras) com os itens; `valorTotal` e custos só para quem pode ver custo. */
export async function listarEntradas(orgId: string, verCusto: boolean, id?: string): Promise<Entrada[]> {
  const w: SQL[] = [eq(entrada.organizationId, orgId)];
  if (id) w.push(eq(entrada.id, id));
  const rows = await db
    .select({ e: entrada, fornecedorNome: fornecedor.nome })
    .from(entrada)
    .leftJoin(fornecedor, eq(fornecedor.id, entrada.fornecedorId))
    .where(and(...w))
    .orderBy(desc(entrada.data), desc(entrada.createdAt))
    .limit(id ? 1 : 200);

  const itens = await itensDasEntradas(
    orgId,
    rows.map((r) => r.e.id),
    verCusto,
  );
  return rows.map(({ e, fornecedorNome }) => ({
    id: e.id,
    fornecedorId: e.fornecedorId,
    fornecedorNome: fornecedorNome ?? null,
    numeroNota: e.numeroNota,
    serie: e.serie,
    chaveNfe: e.chaveNfe,
    dataEmissao: e.dataEmissao,
    data: e.data,
    ...(verCusto ? { valorTotal: e.valorTotal == null ? null : Number(e.valorTotal) } : {}),
    origem: e.origem as OrigemEntrada,
    estornadaEm: e.estornadaEm?.toISOString() ?? null,
    itens: itens.filter((m) => m.origemId === e.id),
  }));
}
