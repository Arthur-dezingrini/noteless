import "server-only";

import {
  entradaSchema,
  fornecedorSchema,
  inventarioResumoSchema,
  inventarioSchema,
  localSchema,
  paginaMovimentosSchema,
  produtoSchema,
  saldoProdutoSchema,
  type Entrada,
  type Fornecedor,
  type Inventario,
  type InventarioResumo,
  type Local,
  type PaginaMovimentos,
  type Produto,
  type SaldoProduto,
} from "@vocare/shared";
import { cache } from "react";
import { z } from "zod";

import { apiFetch } from "@/lib/api";

/** Buscas do estoque na api, para páginas e layouts (server-only). */

const raiz = (orgId: string) => `/api/org/${encodeURIComponent(orgId)}/estoque`;

async function buscar<T>(caminho: string, schema: z.ZodType<T>, vazio: T): Promise<T> {
  const res = await apiFetch(caminho);
  if (!res.ok) return vazio;
  const parsed = schema.safeParse(await res.json());
  return parsed.success ? parsed.data : vazio;
}

const consulta = (filtro: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(filtro).filter((e): e is [string, string] => !!e[1])).toString();
  return q ? `?${q}` : "";
};

export const getProdutos = cache((orgId: string): Promise<Produto[]> => buscar(`${raiz(orgId)}/produtos`, z.array(produtoSchema), []));

export const getLocais = cache((orgId: string): Promise<Local[]> => buscar(`${raiz(orgId)}/locais`, z.array(localSchema), []));

export const getFornecedores = cache(
  (orgId: string): Promise<Fornecedor[]> => buscar(`${raiz(orgId)}/fornecedores`, z.array(fornecedorSchema), []),
);

export const getSaldo = cache(
  (orgId: string, categoria?: string, localId?: string): Promise<SaldoProduto[]> =>
    buscar(`${raiz(orgId)}/saldo${consulta({ categoria, localId })}`, z.array(saldoProdutoSchema), []),
);

export const getMovimentos = cache(
  (orgId: string, filtro: Record<string, string | undefined>): Promise<PaginaMovimentos> =>
    buscar(`${raiz(orgId)}/movimentos${consulta(filtro)}`, paginaMovimentosSchema, { itens: [], temMais: false }),
);

export const getEntradas = cache((orgId: string): Promise<Entrada[]> => buscar(`${raiz(orgId)}/entradas`, z.array(entradaSchema), []));

export const getInventarios = cache(
  (orgId: string): Promise<InventarioResumo[]> => buscar(`${raiz(orgId)}/inventarios`, z.array(inventarioResumoSchema), []),
);

export const getInventario = cache(
  (orgId: string, id: string): Promise<Inventario | null> =>
    buscar(`${raiz(orgId)}/inventarios/${encodeURIComponent(id)}`, inventarioSchema.nullable(), null),
);
