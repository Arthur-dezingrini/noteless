import { z } from "zod";

import { especieSchema } from "./animais";

export const TIPOS_CONSULTA = [
  "consulta",
  "vacinacao",
  "retorno",
  "cirurgia",
  "checkup",
  "exame",
  "outro",
] as const;
export const tipoConsultaSchema = z.enum(TIPOS_CONSULTA);
export type TipoConsulta = z.infer<typeof tipoConsultaSchema>;

export const ROTULO_TIPO_CONSULTA: Record<TipoConsulta, string> = {
  consulta: "Consulta clínica",
  vacinacao: "Vacinação",
  retorno: "Retorno",
  cirurgia: "Cirurgia",
  checkup: "Check-up",
  exame: "Exame",
  outro: "Outro",
};

export const STATUS_CONSULTA = [
  "agendada",
  "confirmada",
  "urgente",
  "concluida",
  "cancelada",
] as const;
export const statusConsultaSchema = z.enum(STATUS_CONSULTA);
export type StatusConsulta = z.infer<typeof statusConsultaSchema>;

export const ROTULO_STATUS_CONSULTA: Record<StatusConsulta, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  urgente: "Urgente",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");

/**
 * Uma consulta como a agenda mostra — já com o nome do alvo e do veterinário.
 * O alvo é um animal ou um grupo ("vacinar o Lote 4").
 */
export const consultaSchema = z.object({
  id: z.string(),
  animalId: z.string().nullish(),
  animalNumero: z.string().nullish(),
  /** Nome do animal, ou do grupo quando a consulta é do grupo. */
  animalNome: z.string(),
  animalEspecie: especieSchema.nullish(),
  animalTutor: z.string().nullish(),
  grupoId: z.string().nullish(),
  /** "Onde fica" do animal ou do grupo. */
  local: z.string().nullish(),
  veterinarioId: z.string().nullish(),
  veterinarioNome: z.string().nullish(),
  data: dataIso,
  hora: horaHHMM,
  duracaoMin: z.number().int(),
  tipo: tipoConsultaSchema,
  status: statusConsultaSchema,
  observacoes: z.string().nullish(),
  /** O atendimento registrado para esta consulta, se já houver. */
  prontuarioId: z.string().nullish(),
  createdAt: z.coerce.date(),
});

export const consultaListaSchema = z.array(consultaSchema);
export type Consulta = z.infer<typeof consultaSchema>;

const baseConsultaSchema = z.object({
  animalId: z.string().nullish(),
  grupoId: z.string().nullish(),
  veterinarioId: z.string().nullish(),
  data: dataIso,
  hora: horaHHMM,
  duracaoMin: z.coerce.number().int().min(5, "Duração mínima: 5 min.").max(480, "Duração máxima: 8 h."),
  tipo: tipoConsultaSchema,
  observacoes: z.string().trim().max(1000, "No máximo 1000 caracteres.").nullish(),
});
const temAlvo = (d: { animalId?: string | null; grupoId?: string | null }) => !!(d.animalId || d.grupoId);
const escolhaAlvo = { message: "Escolha o animal.", path: ["animalId"] };

export const criarConsultaSchema = baseConsultaSchema.refine(temAlvo, escolhaAlvo);
export type CriarConsultaInput = z.infer<typeof baseConsultaSchema>;

/** A edição manda tudo de volta, mais o status. */
export const atualizarConsultaSchema = baseConsultaSchema
  .extend({ status: statusConsultaSchema })
  .refine(temAlvo, escolhaAlvo);
export type AtualizarConsultaInput = z.infer<typeof atualizarConsultaSchema>;
