import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "../schema";

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
