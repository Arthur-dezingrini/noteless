import { customType, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { animal } from "./animais";
import { organization, user } from "../schema";

/**
 * Registro de ocorrência: o áudio que chegou do campo, já transcrito e
 * interpretado. As operações propostas ficam em JSON porque são uma sugestão,
 * não dado do sistema — só na confirmação viram linhas nas tabelas de verdade.
 *
 * O áudio fica em `ocorrencia_audio` para quem confere poder ouvir.
 * Transcrição vazia = áudio não entendido; quem confere escreve o que foi dito.
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
    // Membro sem permissão de salvar confere e passa para o administrador.
    encaminhadaPorId: text("encaminhada_por_id").references(() => user.id, { onDelete: "set null" }),
    encaminhadaEm: timestamp("encaminhada_em"),
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

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * O áudio original, para ouvir na conferência. Separado da ocorrência para a
 * lista não carregar bytes à toa. Áudio de ocorrência é curto (segundos), cabe
 * bem no banco; se crescer, vai para um storage de arquivos.
 */
export const ocorrenciaAudio = pgTable("ocorrencia_audio", {
  ocorrenciaId: text("ocorrencia_id")
    .primaryKey()
    .references(() => ocorrencia.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  dados: bytea("dados").notNull(),
});
