import { z } from "zod";

import { especieSchema, sexoSchema } from "../animais";
import { tipoConsultaSchema } from "./consultas";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");

/**
 * Medidas do exame físico que o formulário oferece. Os valores são texto
 * ("72 bpm", "< 2 s") porque é assim que o veterinário anota.
 */
export const MEDIDAS_EXAME = ["FC", "FR", "Temperatura", "Peso", "TPC"] as const;

export const medidaSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  valor: z.string().trim().min(1).max(60),
});
export const remedioReceitadoSchema = z.object({
  nome: z.string().trim().min(1, "Diga o nome do remédio.").max(120),
  como: z.string().trim().max(300).default(""),
});
export const examePedidoSchema = z.object({
  nome: z.string().trim().min(1, "Diga o nome do exame.").max(120),
  resultado: z.string().trim().max(200).default(""),
});

/** O registro de um atendimento, como a tela de Prontuários mostra. */
export const prontuarioSchema = z.object({
  id: z.string(),
  animalId: z.string(),
  animalNome: z.string(),
  animalNumero: z.string().nullish(),
  animalEspecie: especieSchema,
  animalRaca: z.string().nullish(),
  animalSexo: sexoSchema.nullish(),
  animalNascimento: z.string().nullish(),
  /** A consulta da agenda que este atendimento registra, se houver. */
  consultaId: z.string().nullish(),
  veterinarioId: z.string().nullish(),
  veterinarioNome: z.string().nullish(),
  data: dataIso,
  tipo: tipoConsultaSchema,
  queixa: z.string(),
  exame: z.array(medidaSchema),
  diagnostico: z.string(),
  remedios: z.array(remedioReceitadoSchema),
  exames: z.array(examePedidoSchema),
  retorno: z.object({ id: z.string(), data: dataIso, hora: horaHHMM }).nullish(),
  createdAt: z.coerce.date(),
});
export const prontuarioListaSchema = z.array(prontuarioSchema);
export type Prontuario = z.infer<typeof prontuarioSchema>;

const baseProntuarioSchema = z.object({
  animalId: z.string().min(1, "Escolha o animal."),
  consultaId: z.string().nullish(),
  veterinarioId: z.string().nullish(),
  data: dataIso,
  tipo: tipoConsultaSchema,
  queixa: z.string().trim().max(2000, "No máximo 2000 caracteres.").default(""),
  exame: z.array(medidaSchema).max(20).default([]),
  diagnostico: z.string().trim().max(2000, "No máximo 2000 caracteres.").default(""),
  remedios: z.array(remedioReceitadoSchema).max(20).default([]),
  exames: z.array(examePedidoSchema).max(20).default([]),
  /** Marca o retorno na agenda junto. Sem hora, não marca. */
  retorno: z.object({ data: dataIso, hora: horaHHMM }).nullish(),
});

const temConteudo = (d: { queixa: string; diagnostico: string; exame: unknown[]; remedios: unknown[]; exames: unknown[] }) =>
  !!(d.queixa || d.diagnostico || d.exame.length || d.remedios.length || d.exames.length);
const vazio = { message: "Escreva pelo menos a queixa ou o diagnóstico.", path: ["queixa"] };

export const criarProntuarioSchema = baseProntuarioSchema.refine(temConteudo, vazio);
export const atualizarProntuarioSchema = baseProntuarioSchema.refine(temConteudo, vazio);
export type SalvarProntuarioInput = z.input<typeof baseProntuarioSchema>;
