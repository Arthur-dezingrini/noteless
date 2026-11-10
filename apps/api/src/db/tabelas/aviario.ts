import { boolean, date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { ocorrencia } from "./notas";
import { organization, user } from "../schema";

/**
 * Aviário de matrizes: instalações (galpões), lotes de aves, onde cada lote
 * esteve alojado e o apontamento diário por galpão. Os indicadores (postura,
 * mortalidade, ração por ave) são calculados em `@vocare/shared`, não gravados.
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

const origemOcorrencia = () => ({
  ocorrenciaId: text("ocorrencia_id").references(() => ocorrencia.id, { onDelete: "set null" }),
});

/** Onde as aves ficam. Valores de `tipo`: `TIPOS_INSTALACAO` de `@vocare/shared`. */
export const instalacao = pgTable(
  "instalacao",
  {
    ...base(),
    nome: text("nome").notNull(),
    tipo: text("tipo").notNull(),
    capacidade: integer("capacidade"),
    areaM2: numeric("area_m2", { precision: 10, scale: 2 }),
    ativa: boolean("ativa").notNull().default(true),
  },
  (t) => [uniqueIndex("instalacao_org_nome_uq").on(t.organizationId, t.nome)],
);

/** Valores de `fase` e `situacao`: `FASES_LOTE` e `SITUACOES_LOTE`. */
export const lote = pgTable(
  "lote",
  {
    ...base(),
    codigo: text("codigo").notNull(),
    especie: text("especie").notNull(),
    linhagem: text("linhagem"),
    dataAlojamento: date("data_alojamento").notNull(),
    idadeAlojamentoDias: integer("idade_alojamento_dias").notNull().default(0),
    femeasIniciais: integer("femeas_iniciais").notNull(),
    machosIniciais: integer("machos_iniciais").notNull(),
    fase: text("fase").notNull().default("recria"),
    situacao: text("situacao").notNull().default("ativo"),
    dataEncerramento: date("data_encerramento"),
  },
  (t) => [uniqueIndex("lote_org_codigo_uq").on(t.organizationId, t.codigo)],
);

/** Período em que um lote ocupou uma instalação. `fim` vazio = ainda alojado. */
export const alojamento = pgTable(
  "alojamento",
  {
    ...base(),
    loteId: text("lote_id")
      .notNull()
      .references(() => lote.id, { onDelete: "cascade" }),
    instalacaoId: text("instalacao_id")
      .notNull()
      .references(() => instalacao.id, { onDelete: "cascade" }),
    inicio: date("inicio").notNull(),
    fim: date("fim"),
    femeas: integer("femeas").notNull(),
    machos: integer("machos").notNull(),
  },
  (t) => [index("alojamento_instalacao_inicio_idx").on(t.instalacaoId, t.inicio)],
);

/** Um dia de um galpão. Único por (instalação, data); `loteId` vem do alojamento aberto. */
export const apontamentoAviario = pgTable(
  "apontamento_aviario",
  {
    ...base(),
    ...origemOcorrencia(),
    instalacaoId: text("instalacao_id")
      .notNull()
      .references(() => instalacao.id, { onDelete: "cascade" }),
    loteId: text("lote_id")
      .notNull()
      .references(() => lote.id, { onDelete: "cascade" }),
    data: date("data").notNull(),
    mortasFemeas: integer("mortas_femeas"),
    mortasMachos: integer("mortas_machos"),
    eliminadasFemeas: integer("eliminadas_femeas"),
    eliminadasMachos: integer("eliminadas_machos"),
    ovosTotal: integer("ovos_total"),
    ovosIncubaveis: integer("ovos_incubaveis"),
    ovosTrincados: integer("ovos_trincados"),
    ovosSujos: integer("ovos_sujos"),
    ovosDuasGemas: integer("ovos_duas_gemas"),
    ovosDescarte: integer("ovos_descarte"),
    racaoKg: numeric("racao_kg", { precision: 10, scale: 2 }),
    aguaL: numeric("agua_l", { precision: 10, scale: 2 }),
    observacoes: text("observacoes"),
  },
  (t) => [
    uniqueIndex("apontamento_aviario_instalacao_data_uq").on(t.instalacaoId, t.data),
    index("apontamento_aviario_lote_data_idx").on(t.loteId, t.data),
  ],
);

/** Valores de `sexo`: `SEXOS` de `@vocare/shared`. */
export const pesagemLote = pgTable(
  "pesagem_lote",
  {
    ...base(),
    ...origemOcorrencia(),
    loteId: text("lote_id")
      .notNull()
      .references(() => lote.id, { onDelete: "cascade" }),
    instalacaoId: text("instalacao_id").references(() => instalacao.id, { onDelete: "cascade" }),
    data: date("data").notNull(),
    sexo: text("sexo").notNull(),
    pesoMedioG: numeric("peso_medio_g", { precision: 8, scale: 2 }).notNull(),
    uniformidadePct: numeric("uniformidade_pct", { precision: 5, scale: 2 }),
    amostra: integer("amostra"),
  },
  (t) => [index("pesagem_lote_lote_data_idx").on(t.loteId, t.data)],
);

/** Separada de `vacina` (que exige `animalId`) para não mexer no que já funciona. */
export const vacinacaoLote = pgTable(
  "vacinacao_lote",
  {
    ...base(),
    ...origemOcorrencia(),
    loteId: text("lote_id")
      .notNull()
      .references(() => lote.id, { onDelete: "cascade" }),
    vacina: text("vacina").notNull(),
    via: text("via"),
    data: date("data").notNull(),
    proximaData: date("proxima_data"),
  },
  (t) => [index("vacinacao_lote_org_proxima_idx").on(t.organizationId, t.proximaData)],
);
