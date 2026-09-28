import { date, index, integer, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { animal } from "./animais";
import { ocorrencia } from "./ocorrencias";
import { organization, user } from "./schema";

/**
 * Histórico do animal: cada evento é uma linha, com a ocorrência de onde veio
 * (quando veio de um áudio) e quem salvou. A ficha do animal e os relatórios
 * leem daqui.
 */
const comum = () => ({
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  animalId: text("animal_id")
    .notNull()
    .references(() => animal.id, { onDelete: "cascade" }),
  ocorrenciaId: text("ocorrencia_id").references(() => ocorrencia.id, { onDelete: "set null" }),
  criadoPorId: text("criado_por_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pesagem = pgTable(
  "pesagem",
  {
    ...comum(),
    pesoKg: numeric("peso_kg", { precision: 7, scale: 2 }).notNull(),
    data: date("data").notNull(),
  },
  (t) => [index("pesagem_animal_id_idx").on(t.animalId, t.data)],
);

export const vacina = pgTable(
  "vacina",
  {
    ...comum(),
    vacina: text("vacina").notNull(),
    dose: text("dose"),
    data: date("data").notNull(),
    // Quando vence / próxima dose. Os relatórios de "a vencer" usam isto.
    proximaData: date("proxima_data"),
  },
  (t) => [
    index("vacina_animal_id_idx").on(t.animalId, t.data),
    index("vacina_org_proxima_idx").on(t.organizationId, t.proximaData),
  ],
);

/** Remédio/tratamento. "Em tratamento" = fim ainda não passou. */
export const tratamento = pgTable(
  "tratamento",
  {
    ...comum(),
    remedio: text("remedio").notNull(),
    dose: text("dose"),
    inicio: date("inicio").notNull(),
    fim: date("fim"),
    // Dias sem abate/ordenha depois do fim.
    carenciaDias: integer("carencia_dias"),
  },
  (t) => [index("tratamento_org_fim_idx").on(t.organizationId, t.fim)],
);

export const parto = pgTable(
  "parto",
  {
    ...comum(),
    data: date("data").notNull(),
    crias: integer("crias"),
    observacoes: text("observacoes"),
  },
  (t) => [index("parto_animal_id_idx").on(t.animalId)],
);

/** Grupo de animais (lote, baia, ninhada) — alvo de uma operação em massa. */
export const grupo = pgTable(
  "grupo",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    // Chave de espécie do contrato, ou "misturado".
    especie: text("especie"),
    local: text("local"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("grupo_organization_id_idx").on(t.organizationId)],
);

export const grupoAnimal = pgTable(
  "grupo_animal",
  {
    grupoId: text("grupo_id")
      .notNull()
      .references(() => grupo.id, { onDelete: "cascade" }),
    animalId: text("animal_id")
      .notNull()
      .references(() => animal.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.grupoId, t.animalId] }), index("grupo_animal_animal_id_idx").on(t.animalId)],
);

/** Aviso para um usuário numa organização. `lidaEm` nulo = não lida. */
export const notificacao = pgTable(
  "notificacao",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    detalhe: text("detalhe"),
    link: text("link"),
    lidaEm: timestamp("lida_em"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notificacao_user_org_idx").on(t.userId, t.organizationId, t.createdAt)],
);
