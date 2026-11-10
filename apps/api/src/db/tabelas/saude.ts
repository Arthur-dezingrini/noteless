import { date, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { animal } from "./animais";
import { grupo } from "./historico";
import { organization, user } from "../schema";

/**
 * Consultas/atendimentos agendados. Uma consulta pertence à organização e a
 * um animal; o veterinário é um usuário da organização (opcional).
 *
 * `data` e `hora` ficam separadas de propósito: a agenda filtra por dia e o
 * horário é "de parede" (sem fuso) — 08:00 é 08:00 na fazenda, sempre.
 */
export const consulta = pgTable(
  "consulta",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Um animal OU um grupo (vacinar o lote, pesar o lote).
    animalId: text("animal_id").references(() => animal.id, { onDelete: "cascade" }),
    grupoId: text("grupo_id").references(() => grupo.id, { onDelete: "cascade" }),
    // Se o veterinário sair da organização, a consulta fica sem responsável
    // em vez de sumir.
    veterinarioId: text("veterinario_id").references(() => user.id, { onDelete: "set null" }),
    data: date("data").notNull(),
    hora: text("hora").notNull(), // "HH:MM"
    duracaoMin: integer("duracao_min").notNull().default(30),
    // Chaves do contrato (@vocare/shared) — texto, não enum do Postgres.
    tipo: text("tipo").notNull(),
    status: text("status").notNull().default("agendada"),
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("consulta_organization_id_data_idx").on(table.organizationId, table.data),
    index("consulta_animal_id_idx").on(table.animalId),
  ],
);

/**
 * Prontuário: o registro de um atendimento — queixa, exame físico,
 * diagnóstico, remédios receitados e exames pedidos. Normalmente documenta
 * uma consulta concluída da agenda (`consultaId`), mas pode nascer solto
 * (atendimento de emergência que não foi agendado).
 *
 * Exame, remédios e exames ficam em JSON: são listas curtas que só se leem
 * junto do atendimento. O remédio que o animal passa a tomar de fato continua
 * em `tratamento`; aqui é a receita.
 */
export const prontuario = pgTable(
  "prontuario",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    animalId: text("animal_id")
      .notNull()
      .references(() => animal.id, { onDelete: "cascade" }),
    // Um atendimento por consulta.
    consultaId: text("consulta_id")
      .unique()
      .references(() => consulta.id, { onDelete: "set null" }),
    veterinarioId: text("veterinario_id").references(() => user.id, { onDelete: "set null" }),
    data: date("data").notNull(),
    tipo: text("tipo").notNull(),
    queixa: text("queixa").notNull().default(""),
    // Formas: medida[], remedioReceitado[], examePedido[] do @vocare/shared.
    exame: jsonb("exame").notNull().default([]),
    diagnostico: text("diagnostico").notNull().default(""),
    remedios: jsonb("remedios").notNull().default([]),
    exames: jsonb("exames").notNull().default([]),
    // O retorno marcado junto, na agenda.
    retornoId: text("retorno_id").references(() => consulta.id, { onDelete: "set null" }),
    criadoPorId: text("criado_por_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("prontuario_organization_id_data_idx").on(table.organizationId, table.data),
    index("prontuario_animal_id_idx").on(table.animalId),
  ],
);
