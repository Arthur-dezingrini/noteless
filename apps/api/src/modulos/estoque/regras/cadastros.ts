import {
  CATEGORIAS_COM_LOTE,
  type criarFornecedorSchema,
  type criarLocalSchema,
  type criarProdutoSchema,
  type editarFornecedorSchema,
  type editarLocalSchema,
  type editarProdutoSchema,
  type Fornecedor,
  type Local,
  type Produto,
} from "@vocare/shared";
import { and, eq, ne } from "drizzle-orm";
import type { z } from "zod";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { instalacao } from "../../../db/tabelas/aviario";
import { fornecedor, localEstoque, produto } from "../../../db/tabelas/estoque";
import { listarFornecedores, listarLocais, listarProdutos } from "../consultas/cadastros";
import { unicoViolado } from "./falha";

const PRODUTO_REPETIDO = "Já existe um produto com esse nome.";
const LOCAL_REPETIDO = "Já existe um local com esse nome.";
const SILO_REPETIDO = "Este galpão já tem um silo ativo.";
const DOCUMENTO_REPETIDO = "Já existe um fornecedor com esse documento.";

const texto = (v: number | null | undefined) => (v == null ? v : String(v));

/** Só os campos que vieram (undefined fica de fora do update). */
function definidos<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// Produtos

export async function criarProduto(
  orgId: string,
  userId: string,
  dados: z.infer<typeof criarProdutoSchema>,
  verCusto: boolean,
): Promise<Resultado<Produto>> {
  try {
    const [novo] = await db
      .insert(produto)
      .values({
        organizationId: orgId,
        criadoPorId: userId,
        nome: dados.nome,
        categoria: dados.categoria,
        unidade: dados.unidade,
        embalagemNome: dados.embalagemNome ?? null,
        embalagemFator: texto(dados.embalagemFator) ?? null,
        estoqueMinimo: texto(dados.estoqueMinimo) ?? null,
        controlaLote: dados.controlaLote ?? CATEGORIAS_COM_LOTE.includes(dados.categoria),
      })
      .returning({ id: produto.id });
    const [criado] = await listarProdutos(orgId, verCusto, novo!.id);
    return ok(criado!);
  } catch (e) {
    if (unicoViolado(e) !== null) return falha(409, PRODUTO_REPETIDO);
    throw e;
  }
}

export async function editarProduto(
  orgId: string,
  id: string,
  dados: z.infer<typeof editarProdutoSchema>,
  verCusto: boolean,
): Promise<Resultado<Produto>> {
  const campos = definidos({
    ...dados,
    embalagemFator: texto(dados.embalagemFator),
    estoqueMinimo: texto(dados.estoqueMinimo),
  });
  try {
    const feito =
      Object.keys(campos).length === 0
        ? await db.select({ id: produto.id }).from(produto).where(and(eq(produto.id, id), eq(produto.organizationId, orgId)))
        : await db
            .update(produto)
            .set(campos)
            .where(and(eq(produto.id, id), eq(produto.organizationId, orgId)))
            .returning({ id: produto.id });
    if (feito.length === 0) return falha(404, "Produto não encontrado.");
    const [editado] = await listarProdutos(orgId, verCusto, id);
    return ok(editado!);
  } catch (e) {
    if (unicoViolado(e) !== null) return falha(409, PRODUTO_REPETIDO);
    throw e;
  }
}

// Locais

type EstadoLocal = { tipo: string; instalacaoId: string | null; ativo: boolean };

/** Galpão da organização e, se o local for um silo ativo, sem outro silo ativo nele. */
async function conferirGalpao(orgId: string, estado: EstadoLocal, exceto?: string): Promise<Resultado<void>> {
  if (!estado.instalacaoId) return ok(undefined);
  const [g] = await db
    .select({ id: instalacao.id })
    .from(instalacao)
    .where(and(eq(instalacao.id, estado.instalacaoId), eq(instalacao.organizationId, orgId)));
  if (!g) return falha(404, "Galpão não encontrado.");
  if (estado.tipo !== "silo" || !estado.ativo) return ok(undefined);

  const filtros = [eq(localEstoque.instalacaoId, estado.instalacaoId), eq(localEstoque.tipo, "silo"), eq(localEstoque.ativo, true)];
  if (exceto) filtros.push(ne(localEstoque.id, exceto));
  const [outro] = await db.select({ id: localEstoque.id }).from(localEstoque).where(and(...filtros)).limit(1);
  return outro ? falha(409, SILO_REPETIDO) : ok(undefined);
}

const erroDeLocal = (e: unknown): Resultado<never> | null => {
  const nome = unicoViolado(e);
  if (nome === null) return null;
  return falha(409, nome.includes("silo") ? SILO_REPETIDO : LOCAL_REPETIDO);
};

export async function criarLocal(orgId: string, userId: string, dados: z.infer<typeof criarLocalSchema>): Promise<Resultado<Local>> {
  const galpao = await conferirGalpao(orgId, { tipo: dados.tipo, instalacaoId: dados.instalacaoId ?? null, ativo: true });
  if (!galpao.ok) return galpao;
  try {
    const [novo] = await db
      .insert(localEstoque)
      .values({ organizationId: orgId, criadoPorId: userId, nome: dados.nome, tipo: dados.tipo, instalacaoId: dados.instalacaoId ?? null })
      .returning({ id: localEstoque.id });
    const [criado] = await listarLocais(orgId, novo!.id);
    return ok(criado!);
  } catch (e) {
    const r = erroDeLocal(e);
    if (r) return r;
    throw e;
  }
}

export async function editarLocal(orgId: string, id: string, dados: z.infer<typeof editarLocalSchema>): Promise<Resultado<Local>> {
  const [atual] = await db
    .select()
    .from(localEstoque)
    .where(and(eq(localEstoque.id, id), eq(localEstoque.organizationId, orgId)));
  if (!atual) return falha(404, "Local não encontrado.");

  const campos = definidos(dados);
  const galpao = await conferirGalpao(
    orgId,
    {
      tipo: campos.tipo ?? atual.tipo,
      instalacaoId: campos.instalacaoId === undefined ? atual.instalacaoId : campos.instalacaoId,
      ativo: campos.ativo ?? atual.ativo,
    },
    id,
  );
  if (!galpao.ok) return galpao;
  try {
    if (Object.keys(campos).length > 0) await db.update(localEstoque).set(campos).where(eq(localEstoque.id, id));
    const [editado] = await listarLocais(orgId, id);
    return ok(editado!);
  } catch (e) {
    const r = erroDeLocal(e);
    if (r) return r;
    throw e;
  }
}

// Fornecedores

export async function criarFornecedor(
  orgId: string,
  userId: string,
  dados: z.infer<typeof criarFornecedorSchema>,
): Promise<Resultado<Fornecedor>> {
  try {
    const [novo] = await db
      .insert(fornecedor)
      .values({ organizationId: orgId, criadoPorId: userId, nome: dados.nome, documento: dados.documento ?? null, telefone: dados.telefone ?? null })
      .returning({ id: fornecedor.id });
    const [criado] = await listarFornecedores(orgId, novo!.id);
    return ok(criado!);
  } catch (e) {
    if (unicoViolado(e) !== null) return falha(409, DOCUMENTO_REPETIDO);
    throw e;
  }
}

export async function editarFornecedor(
  orgId: string,
  id: string,
  dados: z.infer<typeof editarFornecedorSchema>,
): Promise<Resultado<Fornecedor>> {
  const campos = definidos(dados);
  try {
    const feito =
      Object.keys(campos).length === 0
        ? await db.select({ id: fornecedor.id }).from(fornecedor).where(and(eq(fornecedor.id, id), eq(fornecedor.organizationId, orgId)))
        : await db
            .update(fornecedor)
            .set(campos)
            .where(and(eq(fornecedor.id, id), eq(fornecedor.organizationId, orgId)))
            .returning({ id: fornecedor.id });
    if (feito.length === 0) return falha(404, "Fornecedor não encontrado.");
    const [editado] = await listarFornecedores(orgId, id);
    return ok(editado!);
  } catch (e) {
    if (unicoViolado(e) !== null) return falha(409, DOCUMENTO_REPETIDO);
    throw e;
  }
}
