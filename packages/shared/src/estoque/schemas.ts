import { z } from "zod";

import { CATEGORIAS_PRODUTO, ORIGENS_ENTRADA, ORIGENS_MOVIMENTO, TIPOS_LOCAL, TIPOS_MOVIMENTO, UNIDADES_ESTOQUE } from "./constantes";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const id = z.string().trim().min(1, "Campo obrigatório.");
const nome = z.string().trim().min(1, "Informe o nome.").max(80, "No máximo 80 caracteres.");
const textoCurto = (max: number) => z.string().trim().max(max, `No máximo ${max} caracteres.`);
const quantidade = z.number({ error: "Informe a quantidade." }).positive("A quantidade deve ser maior que zero.");
const lote = textoCurto(40).nullish();

export const categoriaProdutoSchema = z.enum(CATEGORIAS_PRODUTO, { error: "Categoria inválida." });
export const unidadeEstoqueSchema = z.enum(UNIDADES_ESTOQUE, { error: "Unidade inválida." });
export const tipoLocalSchema = z.enum(TIPOS_LOCAL, { error: "Tipo de local inválido." });

// Cadastros

export const criarProdutoSchema = z.object({
  nome,
  categoria: categoriaProdutoSchema,
  unidade: unidadeEstoqueSchema,
  embalagemNome: textoCurto(30).nullish(),
  embalagemFator: z.number().positive("O fator deve ser maior que zero.").nullish(),
  estoqueMinimo: z.number().nonnegative("O mínimo não pode ser negativo.").nullish(),
  controlaLote: z.boolean().optional(),
});
export const editarProdutoSchema = criarProdutoSchema.partial().extend({ ativo: z.boolean().optional() });

export const criarLocalSchema = z.object({
  nome,
  tipo: tipoLocalSchema,
  instalacaoId: z.string().trim().min(1).nullish(),
});
export const editarLocalSchema = criarLocalSchema.partial().extend({ ativo: z.boolean().optional() });

const documento = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s.length === 11 || s.length === 14, "CPF ou CNPJ inválido.");

export const criarFornecedorSchema = z.object({
  nome,
  documento: documento.nullish(),
  telefone: textoCurto(30).nullish(),
});
export const editarFornecedorSchema = criarFornecedorSchema.partial();

// Lançamentos

export const itemEntradaSchema = z.object({
  produtoId: id,
  localId: id,
  quantidade,
  fator: z.number().positive("O fator deve ser maior que zero.").default(1),
  custoTotal: z.number().nonnegative("O valor não pode ser negativo.").nullish(),
  loteFabricacao: lote,
  validade: dataIso.nullish(),
});

export const entradaManualSchema = z.object({
  fornecedorId: z.string().trim().min(1).nullish(),
  numeroNota: textoCurto(20).nullish(),
  serie: textoCurto(5).nullish(),
  data: dataIso,
  itens: z.array(itemEntradaSchema).min(1, "Inclua pelo menos um item.").max(100, "No máximo 100 itens."),
});

export const saidaInputSchema = z.object({
  produtoId: id,
  localId: id,
  quantidade,
  data: dataIso,
  loteFabricacao: lote,
  motivo: textoCurto(200).nullish(),
  confirmarNegativo: z.boolean().optional(),
});

export const transferenciaInputSchema = z
  .object({
    produtoId: id,
    deLocalId: id,
    paraLocalId: id,
    quantidade,
    data: dataIso,
    loteFabricacao: lote,
  })
  .refine((t) => t.deLocalId !== t.paraLocalId, { message: "Escolha um local de destino diferente.", path: ["paraLocalId"] });

export const estornoInputSchema = z.object({
  motivo: z.string().trim().min(1, "Informe o motivo do estorno.").max(200, "No máximo 200 caracteres."),
});

// Respostas

export const produtoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  categoria: categoriaProdutoSchema,
  unidade: unidadeEstoqueSchema,
  embalagemNome: z.string().nullable(),
  embalagemFator: z.number().nullable(),
  estoqueMinimo: z.number().nullable(),
  controlaLote: z.boolean(),
  ativo: z.boolean(),
  /** Só vem para quem pode ver custo. */
  custoMedio: z.number().optional(),
});
export type Produto = z.infer<typeof produtoSchema>;

export const localSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: tipoLocalSchema,
  instalacaoId: z.string().nullable(),
  instalacaoNome: z.string().nullable(),
  ativo: z.boolean(),
});
export type Local = z.infer<typeof localSchema>;

export const fornecedorSchema = z.object({
  id: z.string(),
  nome: z.string(),
  documento: z.string().nullable(),
  telefone: z.string().nullable(),
});
export type Fornecedor = z.infer<typeof fornecedorSchema>;

export const saldoProdutoSchema = z.object({
  produto: produtoSchema,
  total: z.number(),
  porLocal: z.array(
    z.object({
      localId: z.string(),
      localNome: z.string(),
      quantidade: z.number(),
      diasRestantes: z.number().nullable(),
      lotes: z.array(z.object({ loteFabricacao: z.string(), validade: z.string().nullable(), quantidade: z.number() })),
    }),
  ),
  diasRestantes: z.number().nullable(),
  validadeMaisProxima: z.string().nullable(),
});
export type SaldoProduto = z.infer<typeof saldoProdutoSchema>;

export const movimentoSchema = z.object({
  id: z.string(),
  produtoId: z.string(),
  produtoNome: z.string(),
  unidade: unidadeEstoqueSchema,
  localId: z.string(),
  localNome: z.string(),
  loteFabricacao: z.string(),
  validade: z.string().nullable(),
  tipo: z.enum(TIPOS_MOVIMENTO),
  quantidade: z.number(),
  /** Só vem para quem pode ver custo. */
  custoUnitario: z.number().optional(),
  data: z.string(),
  origemTipo: z.enum(ORIGENS_MOVIMENTO),
  origemId: z.string().nullable(),
  grupoId: z.string().nullable(),
  estornaId: z.string().nullable(),
  estornado: z.boolean(),
  motivo: z.string().nullable(),
  criadoPorNome: z.string().nullable(),
  createdAt: z.string(),
});
export type Movimento = z.infer<typeof movimentoSchema>;

export const paginaMovimentosSchema = z.object({ itens: z.array(movimentoSchema), temMais: z.boolean() });
export type PaginaMovimentos = z.infer<typeof paginaMovimentosSchema>;

export const entradaSchema = z.object({
  id: z.string(),
  fornecedorId: z.string().nullable(),
  fornecedorNome: z.string().nullable(),
  numeroNota: z.string().nullable(),
  serie: z.string().nullable(),
  chaveNfe: z.string().nullable(),
  dataEmissao: z.string().nullable(),
  data: z.string(),
  /** Só vem para quem pode ver custo. */
  valorTotal: z.number().nullable().optional(),
  origem: z.enum(ORIGENS_ENTRADA),
  estornadaEm: z.string().nullable(),
  itens: z.array(movimentoSchema),
});
export type Entrada = z.infer<typeof entradaSchema>;
