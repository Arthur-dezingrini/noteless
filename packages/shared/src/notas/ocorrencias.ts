import { z } from "zod";

import { especieSchema, sexoSchema } from "../animais";
import { tipoConsultaSchema } from "../consultas";
import { CAMPOS_APONTAMENTO, valoresApontamentoBase } from "../aviario";

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
  /** Alvo em massa: um grupo inteiro (vacina, remédio, anotação). */
  grupoId: z.string().nullable().optional(),
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

const textoOpcional = z.string().nullable();
const inteiroOpcional = z.number().int().min(0).nullable();

export const operacaoSchema = z.discriminatedUnion("tipo", [
  baseOperacao.extend({
    tipo: z.literal("agendar_consulta"),
    data: dataIso.nullable(),
    hora: horaHHMM.nullable(),
    tipoConsulta: tipoConsultaSchema,
    observacoes: textoOpcional,
  }),
  baseOperacao.extend({
    tipo: z.literal("registrar_anotacao"),
    texto: z.string().min(1, "A anotação não pode ficar vazia."),
  }),
  baseOperacao.extend({
    tipo: z.literal("registrar_peso"),
    pesoKg: z.number().positive("O peso precisa ser maior que zero.").max(5000, "Peso fora do normal."),
  }),
  baseOperacao.extend({
    tipo: z.literal("aplicar_vacina"),
    vacina: z.string().min(1, "Informe a vacina."),
    dose: textoOpcional,
    /** Dia da aplicação; null = hoje. */
    data: dataIso.nullable(),
    /** Próxima dose / vencimento, se foi dito. */
    proximaData: dataIso.nullable(),
  }),
  baseOperacao.extend({
    tipo: z.literal("registrar_remedio"),
    remedio: z.string().min(1, "Informe o remédio."),
    dose: textoOpcional,
    /** Duração do tratamento em dias, começando hoje. */
    dias: z.number().int().min(1, "Mínimo de 1 dia.").max(365, "No máximo 365 dias.").nullable(),
    carenciaDias: inteiroOpcional,
  }),
  baseOperacao.extend({
    tipo: z.literal("registrar_parto"),
    data: dataIso.nullable(),
    crias: z.number().int().min(0).max(30, "Número de crias fora do normal.").nullable(),
    observacoes: textoOpcional,
  }),
  baseOperacao.extend({
    tipo: z.literal("cadastrar_animal"),
    nome: z.string().trim().min(1, "Informe o nome do animal."),
    especie: especieSchema,
    raca: textoOpcional,
    sexo: sexoSchema.nullable(),
    nascimento: dataIso.nullable(),
  }),
  baseOperacao.extend({
    ...valoresApontamentoBase.shape,
    tipo: z.literal("apontar_galpao"),
    instalacaoId: z.string().nullable(),
    /** Dia do apontamento; null = hoje. */
    data: dataIso.nullable(),
  }),
  baseOperacao.extend({
    tipo: z.literal("pesar_lote"),
    loteId: z.string().nullable(),
    data: dataIso.nullable(),
    sexo: sexoSchema,
    /** null = a IA não ouviu o peso; o revisor completa antes de salvar. */
    pesoMedioG: z.number().positive("Informe um peso maior que zero.").max(10000, "Peso acima de 10.000 g.").nullable(),
    uniformidadePct: z.number().min(0).max(100, "Use de 0 a 100.").nullable(),
    amostra: z.number().int().min(1, "Informe 1 ou mais.").nullable(),
  }),
  baseOperacao.extend({
    tipo: z.literal("vacinar_lote"),
    loteId: z.string().nullable(),
    /** Vazio = a IA não ouviu o nome da vacina; o revisor completa antes de salvar. */
    vacina: z.string(),
    via: textoOpcional,
    data: dataIso.nullable(),
    proximaData: dataIso.nullable(),
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
  aplicar_vacina: { acao: "Registrar vacina", feito: "Vacina registrada", onde: "Histórico do animal › Vacinas" },
  registrar_remedio: { acao: "Registrar remédio", feito: "Remédio registrado", onde: "Histórico do animal › Tratamentos" },
  registrar_parto: { acao: "Registrar parto", feito: "Parto registrado", onde: "Histórico do animal › Partos" },
  cadastrar_animal: { acao: "Cadastrar animal", feito: "Animal cadastrado", onde: "Animais" },
  apontar_galpao: { acao: "Registrar apontamento do galpão", feito: "Apontamento registrado", onde: "Lotes › Diário" },
  pesar_lote: { acao: "Registrar pesagem do lote", feito: "Pesagem do lote registrada", onde: "Lotes › Pesagens" },
  vacinar_lote: { acao: "Registrar vacina do lote", feito: "Vacina do lote registrada", onde: "Lotes › Vacinas" },
};

/** Operações do aviário: miram galpão ou lote, nunca animal. */
export const TIPOS_AVIARIO: readonly TipoOperacao[] = ["apontar_galpao", "pesar_lote", "vacinar_lote"];

/** Tipos que podem mirar um grupo inteiro em vez de um animal. */
export const TIPOS_COM_GRUPO: readonly TipoOperacao[] = [
  "aplicar_vacina",
  "registrar_remedio",
  "registrar_anotacao",
  "agendar_consulta",
];

/** A operação precisa de um alvo do cadastro (animal ou grupo) para ser salva? */
export function precisaAlvo(op: Operacao): boolean {
  return op.tipo !== "cadastrar_animal";
}

/** Tem alvo resolvido — pode ser marcada para salvar. */
export function temAlvo(op: Operacao): boolean {
  if (op.tipo === "apontar_galpao") return !!op.instalacaoId;
  if (op.tipo === "pesar_lote") return !!op.loteId && op.pesoMedioG != null;
  if (op.tipo === "vacinar_lote") return !!op.loteId && op.vacina.trim() !== "";
  return !precisaAlvo(op) || op.animalId !== null || !!op.grupoId;
}

export const ocorrenciaSchema = z.object({
  id: z.string(),
  status: statusOcorrenciaSchema,
  transcricao: z.string(),
  /** Uma frase da IA resumindo o que foi dito. */
  resumo: z.string(),
  duracaoSeg: z.number().nullish(),
  operacoes: z.array(operacaoSchema),
  criadoPorNome: z.string(),
  /** Cargo de quem gravou ("Veterinário", "Ajudante"). */
  criadoPorCargo: z.string().nullish(),
  /** O áudio original está guardado e pode ser ouvido. */
  temAudio: z.boolean().optional(),
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
  registrar_anotacao: ["animalId", "grupoId", "texto"],
  agendar_consulta: ["animalId", "grupoId", "tipoConsulta", "data", "hora", "observacoes"],
  aplicar_vacina: ["animalId", "grupoId", "vacina", "dose", "data", "proximaData"],
  registrar_remedio: ["animalId", "grupoId", "remedio", "dose", "dias", "carenciaDias"],
  registrar_parto: ["animalId", "data", "crias", "observacoes"],
  cadastrar_animal: ["nome", "especie", "raca", "sexo", "nascimento"],
  apontar_galpao: ["instalacaoId", "data", ...CAMPOS_APONTAMENTO, "observacoes"],
  pesar_lote: ["loteId", "data", "sexo", "pesoMedioG", "uniformidadePct", "amostra"],
  vacinar_lote: ["loteId", "vacina", "via", "data", "proximaData"],
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
