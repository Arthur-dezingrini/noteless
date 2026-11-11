import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "../schema";

/**
 * Gravador de campo (a placa ESP32). Aparece sozinho no primeiro aviso de
 * estado; `serie` é o MAC do chip. Fica preso à conta com que entrou
 * (`userId`): outra conta não toma a placa — o super usuário a esquece e ela
 * reaparece no próximo aviso.
 *
 * `estado` guarda só o último aviso (EstadoSalvo do @vocare/shared); o
 * histórico fica no registro do cartão da placa.
 */
export const gravador = pgTable(
  "gravador",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serie: text("serie").notNull().unique(),
    nome: text("nome").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Empresa que recebe as notas; a conta precisa estar vinculada a ela.
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    estado: jsonb("estado").notNull(),
    vistoEm: timestamp("visto_em").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("gravador_organization_id_idx").on(table.organizationId)],
);
