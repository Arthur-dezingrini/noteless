import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { animal } from "./animais";
import { organization, user } from "./schema";

/**
 * Registro de ocorrência: o áudio que chegou do campo, já transcrito e
 * interpretado. As operações propostas ficam em JSON porque são uma sugestão,
 * não dado do sistema — só na confirmação viram linhas nas tabelas de verdade.
 *
 * O áudio em si não é guardado (provisório): sobra a transcrição e a duração.
 */
export const ocorrencia = pgTable(
  "ocorrencia",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    criadoPorId: text("criado_por_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pendente"),
    transcricao: text("transcricao").notNull(),
    resumo: text("resumo").notNull(),
    duracaoSeg: integer("duracao_seg"),
    // Forma: Operacao[] do @vocare/shared, validada na leitura.
    operacoes: jsonb("operacoes").notNull(),
    revisadoPorId: text("revisado_por_id").references(() => user.id, { onDelete: "set null" }),
    revisadoEm: timestamp("revisado_em"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("ocorrencia_organization_id_status_idx").on(table.organizationId, table.status)],
);

/**
 * Anotação livre sobre um animal ("mancando da pata de trás"). Nasce da
 * confirmação de uma ocorrência; o prontuário vai listar isto.
 */
export const anotacaoAnimal = pgTable(
  "anotacao_animal",
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
    ocorrenciaId: text("ocorrencia_id").references(() => ocorrencia.id, { onDelete: "set null" }),
    criadoPorId: text("criado_por_id").references(() => user.id, { onDelete: "set null" }),
    texto: text("texto").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("anotacao_animal_animal_id_idx").on(table.animalId)],
);
