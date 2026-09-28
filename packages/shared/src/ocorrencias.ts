import { z } from "zod";

import { tipoConsultaSchema } from "./consultas";

/**
 * Registro de ocorrência: um áudio do campo, sua transcrição e as operações
 * que a IA propõe. Nada disso vira dado do sistema até um humano confirmar
 * — a confirmação é que aplica as operações escolhidas.
 */
export const STATUS_OCORRENCIA = ["pendente", "confirmada", "descartada"] as const;
export const statusOcorrenciaSchema = z.enum(STATUS_OCORRENCIA);
export type StatusOcorrencia = z.infer<typeof statusOcorrenciaSchema>;

export const ROTULO_STATUS_OCORRENCIA: Record<StatusOcorrencia, string> = {
  pendente: "Para conferir",
  confirmada: "Salva",
  descartada: "Descartada",
};

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const horaHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");

/**
 * O que a IA consegue propor hoje. Cada tipo carrega só os dados que a
 * confirmação precisa para aplicar; o resto (título, detalhe, trecho) é para
 * o revisor ler.
 */
const baseOperacao = z.object({
  titulo: z.string(),
  /** Como o operador chamou o animal ("Thor", "brinco 3"). */
  alvo: z.string(),
  /** Animal do cadastro que a IA entendeu ser o alvo; null = não achou. */
  animalId: z.string().nullable(),
  detalhe: z.string(),
  /** 0–100. Abaixo de 70 a interface pede atenção. */
  confianca: z.number().int().min(0).max(100),
  /** Trecho da transcrição que justifica a operação. */
  trecho: z.string(),
  /** Preenchido na confirmação: esta operação foi aplicada ao sistema? */
  aplicada: z.boolean().optional(),
});

export const operacaoSchema = z.discriminatedUnion("tipo", [
  baseOperacao.extend({
    tipo: z.literal("agendar_consulta"),
    data: dataIso.nullable(),
    hora: horaHHMM.nullable(),
    tipoConsulta: tipoConsultaSchema,
    observacoes: z.string().nullable(),
  }),
  baseOperacao.extend({
    tipo: z.literal("registrar_anotacao"),
    texto: z.string(),
  }),
  baseOperacao.extend({
    tipo: z.literal("registrar_peso"),
    pesoKg: z.number().positive(),
  }),
]);
export type Operacao = z.infer<typeof operacaoSchema>;
export type TipoOperacao = Operacao["tipo"];

/**
 * Como cada operação aparece para quem confere: a ação no infinitivo, no
 * particípio depois de salva, e onde o dado vai parar no sistema.
 */
export const DESTINO_OPERACAO: Record<TipoOperacao, { acao: string; feito: string; onde: string }> = {
  registrar_peso: { acao: "Registrar pesagem", feito: "Pesagem registrada", onde: "Histórico do animal › Pesagens" },
  registrar_anotacao: { acao: "Registrar anotação", feito: "Anotação registrada", onde: "Histórico do animal › Anotações" },
  agendar_consulta: { acao: "Agendar consulta", feito: "Consulta agendada", onde: "Agenda" },
};

export const ocorrenciaSchema = z.object({
  id: z.string(),
  status: statusOcorrenciaSchema,
  transcricao: z.string(),
  /** Uma frase da IA resumindo o que foi dito. */
  resumo: z.string(),
  duracaoSeg: z.number().nullish(),
  operacoes: z.array(operacaoSchema),
  criadoPorNome: z.string(),
  createdAt: z.coerce.date(),
  revisadoPorNome: z.string().nullish(),
  revisadoEm: z.coerce.date().nullish(),
  /** Membro que conferiu e mandou para o administrador salvar. */
  encaminhadaPorNome: z.string().nullish(),
  encaminhadaEm: z.coerce.date().nullish(),
});
export const ocorrenciaListaSchema = z.array(ocorrenciaSchema);
export type Ocorrencia = z.infer<typeof ocorrenciaSchema>;

/** Confirmar = aplicar estas operações (índices na lista) e fechar o registro. */
export const confirmarOcorrenciaSchema = z.object({
  operacoes: z.array(z.number().int().min(0)),
});
export type ConfirmarOcorrenciaInput = z.infer<typeof confirmarOcorrenciaSchema>;

/** Áudio não entendido: quem confere escreve o que foi dito e a IA reinterpreta. */
export const textoOcorrenciaSchema = z.object({
  texto: z.string().trim().min(3, "Escreva o que foi dito.").max(2000, "No máximo 2000 caracteres."),
});
export type TextoOcorrenciaInput = z.infer<typeof textoOcorrenciaSchema>;
