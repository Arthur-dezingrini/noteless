import { sql } from "drizzle-orm";
import { boolean, date, index, numeric, pgTable, text, timestamp, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";

import { instalacao } from "./aviario";
import { ocorrencia } from "./notas";
import { organization, user } from "../schema";

/**
 * Estoque de insumos: produtos, locais (silo de galpão, depósito, geladeira),
 * fornecedores, entradas e o livro de movimentos. `movimento_estoque` nunca
 * se edita nem se apaga — corrigir é estornar; `saldo_estoque` é o resumo
 * por produto × local × lote, atualizado na mesma transação do movimento.
 * Valores de categoria, unidade, tipo e origem: `@vocare/shared` (estoque).
 */
const base = () => ({
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  criadoPorId: text("criado_por_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const quantidade = (nome: string) => numeric(nome, { precision: 14, scale: 3 });
const custo = (nome: string) => numeric(nome, { precision: 14, scale: 4 });

export const produto = pgTable(
  "produto",
  {
    ...base(),
    nome: text("nome").notNull(),
    categoria: text("categoria").notNull(),
    unidade: text("unidade").notNull(),
    embalagemNome: text("embalagem_nome"),
    embalagemFator: custo("embalagem_fator"),
    estoqueMinimo: quantidade("estoque_minimo"),
    controlaLote: boolean("controla_lote").notNull().default(false),
    custoMedio: custo("custo_medio").notNull().default("0"),
    ativo: boolean("ativo").notNull().default(true),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("produto_org_nome_uq").on(t.organizationId, t.nome)],
);

/** Onde o insumo fica. Silo ligado a um galpão é de onde sai a ração do registro diário. */
export const localEstoque = pgTable(
  "local_estoque",
  {
    ...base(),
    nome: text("nome").notNull(),
    tipo: text("tipo").notNull(),
    instalacaoId: text("instalacao_id").references(() => instalacao.id, { onDelete: "set null" }),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [
    uniqueIndex("local_estoque_org_nome_uq").on(t.organizationId, t.nome),
    uniqueIndex("local_estoque_silo_ativo_uq").on(t.instalacaoId).where(sql`"ativo" = true AND "tipo" = 'silo'`),
  ],
);

export const fornecedor = pgTable(
  "fornecedor",
  {
    ...base(),
    nome: text("nome").notNull(),
    /** CPF ou CNPJ, só dígitos. */
    documento: text("documento"),
    telefone: text("telefone"),
  },
  (t) => [uniqueIndex("fornecedor_org_documento_uq").on(t.organizationId, t.documento)],
);

/** "O código X do fornecedor Y é o produto Z, com fator F": a próxima NF-e já vem ligada. */
export const produtoFornecedor = pgTable(
  "produto_fornecedor",
  {
    ...base(),
    fornecedorId: text("fornecedor_id")
      .notNull()
      .references(() => fornecedor.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    unidadeCompra: text("unidade_compra").notNull(),
    fator: custo("fator").notNull(),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "cascade" }),
    localId: text("local_id").references(() => localEstoque.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("produto_fornecedor_codigo_uq").on(t.fornecedorId, t.codigo)],
);

/** Documento de compra (tela, voz ou NF-e); os itens são os movimentos com origem `entrada`. */
export const entrada = pgTable(
  "entrada",
  {
    ...base(),
    fornecedorId: text("fornecedor_id").references(() => fornecedor.id, { onDelete: "set null" }),
    numeroNota: text("numero_nota"),
    serie: text("serie"),
    chaveNfe: text("chave_nfe"),
    dataEmissao: date("data_emissao"),
    data: date("data").notNull(),
    valorTotal: numeric("valor_total", { precision: 14, scale: 2 }),
    origem: text("origem").notNull(),
    xml: text("xml"),
    estornadaEm: timestamp("estornada_em"),
    ocorrenciaId: text("ocorrencia_id").references(() => ocorrencia.id, { onDelete: "set null" }),
  },
  // A mesma NF-e não entra duas vezes — a não ser que a primeira tenha sido estornada (importada errada).
  (t) => [uniqueIndex("entrada_org_chave_nfe_uq").on(t.organizationId, t.chaveNfe).where(sql`"estornada_em" IS NULL`)],
);

/** O livro: uma linha por mudança de saldo, com sinal (+ entra, − sai). */
export const movimentoEstoque = pgTable(
  "movimento_estoque",
  {
    ...base(),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "cascade" }),
    localId: text("local_id")
      .notNull()
      .references(() => localEstoque.id, { onDelete: "cascade" }),
    /** '' quando o produto não controla lote. */
    loteFabricacao: text("lote_fabricacao").notNull().default(""),
    validade: date("validade"),
    tipo: text("tipo").notNull(),
    quantidade: quantidade("quantidade").notNull(),
    custoUnitario: custo("custo_unitario").notNull().default("0"),
    data: date("data").notNull(),
    origemTipo: text("origem_tipo").notNull(),
    /** Id do registro que causou o movimento, sem chave estrangeira (o estoque não depende dos outros módulos). */
    origemId: text("origem_id"),
    /** Os dois lados de uma transferência. */
    grupoId: text("grupo_id"),
    estornaId: text("estorna_id").references((): AnyPgColumn => movimentoEstoque.id, { onDelete: "cascade" }),
    motivo: text("motivo"),
    ocorrenciaId: text("ocorrencia_id").references(() => ocorrencia.id, { onDelete: "set null" }),
  },
  (t) => [
    index("movimento_estoque_org_produto_data_idx").on(t.organizationId, t.produtoId, t.data),
    index("movimento_estoque_org_origem_idx").on(t.organizationId, t.origemTipo, t.origemId),
    index("movimento_estoque_org_lote_idx").on(t.organizationId, t.loteFabricacao),
    // Um movimento só pode ser estornado uma vez, mesmo com dois pedidos ao mesmo tempo.
    uniqueIndex("movimento_estoque_estorna_uq").on(t.estornaId),
  ],
);

/** Saldo por produto × local × lote. Só `lancarMovimento` escreve aqui. */
export const saldoEstoque = pgTable(
  "saldo_estoque",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "cascade" }),
    localId: text("local_id")
      .notNull()
      .references(() => localEstoque.id, { onDelete: "cascade" }),
    loteFabricacao: text("lote_fabricacao").notNull().default(""),
    validade: date("validade"),
    quantidade: quantidade("quantidade").notNull().default("0"),
    /** Desde quando o lote está no local: desempate do FEFO. */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("saldo_estoque_produto_local_lote_uq").on(t.produtoId, t.localId, t.loteFabricacao)],
);

/** Contagem de um local; ao fechar, a diferença vira movimento de ajuste. */
export const inventario = pgTable(
  "inventario",
  {
    ...base(),
    localId: text("local_id")
      .notNull()
      .references(() => localEstoque.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("aberto"),
    abertoEm: timestamp("aberto_em").notNull().defaultNow(),
    fechadoEm: timestamp("fechado_em"),
    fechadoPorId: text("fechado_por_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("inventario_local_aberto_uq").on(t.localId).where(sql`"status" = 'aberto'`)],
);

export const inventarioItem = pgTable(
  "inventario_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    inventarioId: text("inventario_id")
      .notNull()
      .references(() => inventario.id, { onDelete: "cascade" }),
    produtoId: text("produto_id")
      .notNull()
      .references(() => produto.id, { onDelete: "cascade" }),
    loteFabricacao: text("lote_fabricacao").notNull().default(""),
    quantidadeContada: quantidade("quantidade_contada").notNull(),
    /** Saldo do sistema na hora de fechar. */
    quantidadeSistema: quantidade("quantidade_sistema"),
  },
  (t) => [uniqueIndex("inventario_item_uq").on(t.inventarioId, t.produtoId, t.loteFabricacao)],
);
