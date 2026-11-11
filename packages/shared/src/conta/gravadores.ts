import { z } from "zod";

/**
 * Gravadores de campo: a placa (ESP32) que grava e manda as notas. Ela entra
 * com uma conta comum e avisa o estado; o sistema responde para qual empresa
 * as notas vão.
 */

/**
 * Depois disto sem aviso, a placa aparece "sem contato". Ela avisa quando algo
 * muda e, fora isso, a cada 15 min — pouco, de propósito: cada aviso é uma
 * requisição na Vercel e acorda o banco.
 */
export const GRAVADOR_ONLINE_SEG = 20 * 60;

/**
 * O que a placa manda (POST /api/gravadores/estado). Os tempos vêm em "há N
 * segundos": antes de acertar o relógio pela internet, a placa não sabe a hora.
 */
export const estadoGravadorSchema = z.object({
  serie: z.string().min(1).max(32),
  versao: z.string().max(40),
  wifi: z.object({ rede: z.string().max(64), sinalDbm: z.number().int(), ip: z.string().max(45) }),
  fila: z.number().int().min(0),
  recusadas: z.number().int().min(0),
  cartao: z.object({ ok: z.boolean(), livreGb: z.number().nullable() }),
  ultimoErro: z.object({ texto: z.string().max(400), haSeg: z.number().int().min(0) }).nullable(),
  /** Linhas ERRO:/AVISO: ainda não mandadas, da mais antiga para a mais nova (firmware antigo não manda). */
  erros: z
    .array(z.object({ texto: z.string().max(400), haSeg: z.number().int().min(0) }))
    .max(20)
    .default([]),
  boot: z.object({ motivo: z.string().max(80), haSeg: z.number().int().min(0) }),
  empresaAtual: z.string().nullable(),
});
export type EstadoGravadorInput = z.infer<typeof estadoGravadorSchema>;

/** O estado como fica guardado: os "há N segundos" viram data e hora. */
const erroSalvoSchema = z.object({ texto: z.string(), em: z.string() });
export type ErroSalvo = z.infer<typeof erroSalvoSchema>;

/** Quantos erros ficam guardados por placa (o resto está no registro do cartão). */
export const GRAVADOR_MAX_ERROS = 50;

export const estadoSalvoSchema = estadoGravadorSchema.omit({ serie: true, ultimoErro: true, erros: true, boot: true, empresaAtual: true }).extend({
  ultimoErro: erroSalvoSchema.nullable(),
  /** Do mais novo para o mais antigo. */
  erros: z.array(erroSalvoSchema),
  boot: z.object({ motivo: z.string(), em: z.string() }),
});
export type EstadoSalvo = z.infer<typeof estadoSalvoSchema>;

/** Resposta para a placa: a empresa que recebe as notas, ou `null` com o motivo. */
export const respostaEstadoSchema = z.object({
  destino: z.object({ id: z.string(), nome: z.string() }).nullable(),
  aviso: z.string().nullable(),
});
export type RespostaEstado = z.infer<typeof respostaEstadoSchema>;

/** Uma placa na tela de Configurações › Gravadores. */
export const gravadorSchema = z.object({
  id: z.string(),
  serie: z.string(),
  nome: z.string(),
  conta: z.object({ id: z.string(), nome: z.string(), email: z.string() }),
  destino: z.object({ id: z.string(), nome: z.string() }).nullable(),
  /** A conta da placa ainda está vinculada à empresa de destino. */
  destinoValido: z.boolean(),
  vistoEm: z.string(),
  estado: estadoSalvoSchema,
});
export const gravadorListaSchema = z.array(gravadorSchema);
export type Gravador = z.infer<typeof gravadorSchema>;

/** O que o super usuário muda numa placa. */
export const mudarGravadorSchema = z
  .object({
    nome: z.string().trim().min(1, "Dê um nome ao gravador.").max(60, "Nome longo demais.").optional(),
    organizationId: z.string().min(1, "Escolha a empresa.").optional(),
  })
  .refine((v) => v.nome !== undefined || v.organizationId !== undefined, "Nada para mudar.");
export type MudarGravadorInput = z.infer<typeof mudarGravadorSchema>;

export function gravadorOnline(vistoEm: Date | string, agora = new Date()): boolean {
  return agora.getTime() - new Date(vistoEm).getTime() <= GRAVADOR_ONLINE_SEG * 1000;
}

/** Força do Wi-Fi para quem não lê dBm. Abaixo de -80, o envio já falhou na prática. */
export function sinalEmPalavras(dbm: number): "bom" | "fraco" | "muito fraco" {
  if (dbm >= -67) return "bom";
  if (dbm >= -80) return "fraco";
  return "muito fraco";
}

/** "Gravador 1A2B": o fim do MAC, que dá para conferir na serial da placa. */
export function nomePadraoGravador(serie: string): string {
  return `Gravador ${serie.replace(/[^0-9a-f]/gi, "").slice(-4).toUpperCase()}`;
}

/**
 * Histórico de erros da placa: os novos (do mais antigo para o mais novo, como
 * a placa manda) entram no topo. Se a resposta de um aviso se perdeu, a placa
 * manda os mesmos de novo, com hora alguns segundos diferente: esses não
 * duplicam.
 */
export function juntarErros(antigos: ErroSalvo[], novos: ErroSalvo[], max = GRAVADOR_MAX_ERROS): ErroSalvo[] {
  const repetido = (e: ErroSalvo) =>
    antigos.some((a) => a.texto === e.texto && Math.abs(new Date(a.em).getTime() - new Date(e.em).getTime()) < 10_000);
  return [...novos.filter((e) => !repetido(e)).reverse(), ...antigos].slice(0, max);
}
