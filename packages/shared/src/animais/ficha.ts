import { z } from "zod";

import { animalSchema } from "./animais";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TIPOS_EVENTO = ["pesagem", "vacina", "consulta", "anotacao", "tratamento", "parto"] as const;
export const tipoEventoSchema = z.enum(TIPOS_EVENTO);
export type TipoEvento = z.infer<typeof tipoEventoSchema>;

export const ROTULO_TIPO_EVENTO: Record<TipoEvento, string> = {
  pesagem: "Pesagens",
  vacina: "Vacinas",
  consulta: "Consultas",
  anotacao: "Anotações",
  tratamento: "Tratamentos",
  parto: "Partos",
};

/** Uma linha do histórico, de qualquer origem. */
export const eventoSchema = z.object({
  id: z.string(),
  tipo: tipoEventoSchema,
  data: dataIso,
  titulo: z.string(),
  detalhe: z.string().nullish(),
  /** Quem registrou (ou o veterinário, na consulta). */
  por: z.string().nullish(),
  /** Veio de um áudio? */
  ocorrenciaId: z.string().nullish(),
  /** Salvo nas últimas 48 h a partir de uma ocorrência — a tela marca "Novo". */
  novo: z.boolean().optional(),
  /** Consulta com atendimento registrado: a ficha leva ao prontuário. */
  prontuarioId: z.string().nullish(),
});
export type Evento = z.infer<typeof eventoSchema>;

export const pendenciaSchema = z.object({
  id: z.string(),
  texto: z.string(),
  link: z.string().nullish(),
});
export type Pendencia = z.infer<typeof pendenciaSchema>;

/** Um parente na ficha: o link e como ele aparece ("nº 12 Cachaço"). */
export const parenteSchema = z.object({
  id: z.string(),
  rotulo: z.string(),
  nascimento: dataIso.nullish(),
});
export type Parente = z.infer<typeof parenteSchema>;

/** Tudo que a ficha do animal mostra, numa resposta. */
export const fichaAnimalSchema = z.object({
  animal: animalSchema,
  mae: parenteSchema.nullable(),
  pai: parenteSchema.nullable(),
  /** Do mais novo para o mais velho. */
  filhos: z.array(parenteSchema),
  grupos: z.array(z.object({ id: z.string(), nome: z.string() })),
  historico: z.array(eventoSchema),
  proximos: z.array(eventoSchema),
  /** "Precisa de atenção": vacina vencida e afins. */
  pendencias: z.array(pendenciaSchema),
  /** Ocorrências para conferir que falam deste animal (ainda fora do histórico). */
  ocorrenciasPendentes: z.number().int(),
});
export type FichaAnimal = z.infer<typeof fichaAnimalSchema>;
