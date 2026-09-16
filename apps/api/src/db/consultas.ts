import { date, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { animal } from "./animais";
import { organization, user } from "./schema";

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
    animalId: text("animal_id")
      .notNull()
      .references(() => animal.id, { onDelete: "cascade" }),
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
