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
  agendada: "Aguardando",
  confirmada: "Confirmado",
  urgente: "Urgente",
  concluida: "Concluído",
  cancelada: "Cancelado",
};

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");

/** Uma consulta como a agenda mostra — já com o nome do animal e do veterinário. */
export const consultaSchema = z.object({
  id: z.string(),
  animalId: z.string(),
  animalNome: z.string(),
  animalEspecie: especieSchema,
  animalTutor: z.string().nullish(),
  veterinarioId: z.string().nullish(),
  veterinarioNome: z.string().nullish(),
  data: dataIso,
  hora: horaHHMM,
  duracaoMin: z.number().int(),
  tipo: tipoConsultaSchema,
  status: statusConsultaSchema,
  observacoes: z.string().nullish(),
  createdAt: z.coerce.date(),
});

export const consultaListaSchema = z.array(consultaSchema);
export type Consulta = z.infer<typeof consultaSchema>;

export const criarConsultaSchema = z.object({
  animalId: z.string().min(1, "Escolha o animal."),
  veterinarioId: z.string().nullish(),
  data: dataIso,
  hora: horaHHMM,
  duracaoMin: z.coerce.number().int().min(5, "Duração mínima: 5 min.").max(480, "Duração máxima: 8 h."),
  tipo: tipoConsultaSchema,
  observacoes: z.string().trim().max(1000, "No máximo 1000 caracteres.").nullish(),
});
export type CriarConsultaInput = z.infer<typeof criarConsultaSchema>;

/** A edição manda tudo de volta, mais o status. */
export const atualizarConsultaSchema = criarConsultaSchema.extend({
  status: statusConsultaSchema,
});
export type AtualizarConsultaInput = z.infer<typeof atualizarConsultaSchema>;
