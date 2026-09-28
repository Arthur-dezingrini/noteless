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
  /** Trilha de auditoria: o valor que a IA propôs, para cada campo corrigido. */
  original: z.record(z.string(), z.unknown()).optional(),
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
    pesoKg: z.number().positive("O peso precisa ser maior que zero.").max(5000, "Peso fora do normal."),
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

/** Campos que quem confere pode corrigir antes de salvar, por tipo. */
export const CAMPOS_CORRIGIVEIS = {
  registrar_peso: ["animalId", "pesoKg"],
  registrar_anotacao: ["animalId", "texto"],
  agendar_consulta: ["animalId", "tipoConsulta", "data", "hora", "observacoes"],
} as const satisfies Record<TipoOperacao, readonly string[]>;
export type CampoCorrigivel = (typeof CAMPOS_CORRIGIVEIS)[TipoOperacao][number];

/**
 * Confirmar = aplicar estas operações (índices na lista) e fechar o registro.
 * `correcoes` troca campos de uma operação antes de aplicar, por índice.
 */
export const confirmarOcorrenciaSchema = z.object({
  operacoes: z.array(z.number().int().min(0)),
  correcoes: z.record(z.string().regex(/^\d+$/), z.record(z.string(), z.unknown())).optional(),
});
export type ConfirmarOcorrenciaInput = z.infer<typeof confirmarOcorrenciaSchema>;

/** Áudio não entendido: quem confere escreve o que foi dito e a IA reinterpreta. */
export const textoOcorrenciaSchema = z.object({
  texto: z.string().trim().min(3, "Escreva o que foi dito.").max(2000, "No máximo 2000 caracteres."),
});
export type TextoOcorrenciaInput = z.infer<typeof textoOcorrenciaSchema>;

/**
 * Aplica as correções permitidas a uma operação e valida o resultado. Campo
 * fora da lista do tipo é ignorado; `original` guarda o que a IA tinha dito.
 * Usado pela api na confirmação e pela tela para mostrar o valor corrigido.
 */
export function corrigirOperacao(
  op: Operacao,
  correcao: Record<string, unknown> | undefined,
): { ok: true; op: Operacao } | { ok: false; error: string } {
  if (!correcao) return { ok: true, op };
  const permitidos: readonly string[] = CAMPOS_CORRIGIVEIS[op.tipo];
  const atual = op as Record<string, unknown>;
  const mudou: Record<string, unknown> = {};
  const original: Record<string, unknown> = { ...op.original };
  for (const [campo, valor] of Object.entries(correcao)) {
    if (!permitidos.includes(campo) || valor === atual[campo]) continue;
    mudou[campo] = valor;
    if (!(campo in original)) original[campo] = atual[campo];
  }
  if (Object.keys(mudou).length === 0) return { ok: true, op };
  const parsed = operacaoSchema.safeParse({ ...op, ...mudou, original });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Correção inválida." };
  return { ok: true, op: parsed.data };
}
