import { date, index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./schema";

/**
 * Tabelas de negócio ficam aqui, separadas de `schema.ts` — aquele arquivo é
 * gerado pelo Better Auth e qualquer edição manual se perde no próximo
 * `auth:generate`. Novo arquivo de tabela? Registre em `drizzle.config.ts`
 * e em `db/index.ts`.
 */
export const animal = pgTable(
  "animal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Número do brinco, da coleira ou do registro — como o campo chama o animal.
    numero: text("numero"),
    nome: text("nome").notNull(),
    // Chaves do contrato (@vocare/shared): "cao", "gato"… — texto, não enum
    // do Postgres, para incluir espécie nova sem migration.
    especie: text("especie").notNull(),
    raca: text("raca"),
    sexo: text("sexo"),
    nascimento: date("nascimento"),
    pesoKg: numeric("peso_kg", { precision: 7, scale: 2 }),
    tutor: text("tutor"),
    tutorTelefone: text("tutor_telefone"),
    microchip: text("microchip"),
    // "Onde fica": Casa, Baia 1, Lote 2…
    local: text("local"),
    // Preenchida à mão até existir o módulo de consultas.
    ultimaVisita: date("ultima_visita"),
    status: text("status").notNull().default("ativo"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("animal_organization_id_idx").on(table.organizationId)],
);
