import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization, user } from "../schema";

/**
 * Gravador de campo (a placa ESP32). Não tem conta: na primeira vez que liga,
 * a placa sorteia um segredo, e toda chamada leva a série (o MAC do chip) e
 * esse segredo (base/gravador-atual.ts). No primeiro aviso de estado ela
 * aparece aguardando aprovação; o super usuário aprova com o código que a
 * placa mostra e escolhe a empresa. Esquecer a placa corta o acesso: ela volta
 * a aparecer aguardando.
 *
 * `estado` guarda só o último aviso (EstadoSalvo do @vocare/shared); o
 * histórico fica no registro da placa.
 */
export const gravador = pgTable(
  "gravador",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    serie: text("serie").notNull().unique(),
    nome: text("nome").notNull(),
    // SHA-256 do segredo da placa: o segredo mesmo só ela guarda.
    segredoHash: text("segredo_hash").notNull(),
    // O código curto que a placa mostra ("K7F-3QX"); quem aprova digita.
    codigo: text("codigo").notNull(),
    // Nulo enquanto aguarda aprovação.
    aprovadoEm: timestamp("aprovado_em"),
    // Conta técnica criada na aprovação, sem senha (ninguém entra com ela): a
    // autora das notas que a placa manda.
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    // Empresa que recebe as notas.
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    estado: jsonb("estado").notNull(),
    vistoEm: timestamp("visto_em").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("gravador_organization_id_idx").on(table.organizationId)],
);

/**
 * Aceite dos Termos de Uso e da Política de Privacidade: quem aceitou, qual
 * versão, quando e de qual IP. Um registro por pessoa e versão; aceitar de novo
 * mantém o primeiro.
 */
export const aceiteTermos = pgTable(
  "aceite_termos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    versao: text("versao").notNull(),
    aceitoEm: timestamp("aceito_em").notNull().defaultNow(),
    ip: text("ip"),
  },
  (t) => [uniqueIndex("aceite_termos_user_versao_uq").on(t.userId, t.versao)],
);
