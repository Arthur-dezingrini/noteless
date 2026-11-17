import { z } from "zod";

/**
 * Gravadores de campo: a placa (ESP32) que grava e manda as notas. Ela não tem
 * conta: se apresenta com a série e um segredo que sorteou, aparece aguardando
 * aprovação, e o super usuário aprova com o código que ela mostra. Daí em
 * diante ela avisa o estado, e o sistema responde para qual empresa as notas vão.
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
});
export type EstadoGravadorInput = z.infer<typeof estadoGravadorSchema>;

/** O estado como fica guardado: os "há N segundos" viram data e hora. */
const erroSalvoSchema = z.object({ texto: z.string(), em: z.string() });
export type ErroSalvo = z.infer<typeof erroSalvoSchema>;

/** Quantos erros ficam guardados por placa (o resto está no registro do cartão). */
export const GRAVADOR_MAX_ERROS = 50;

export const estadoSalvoSchema = estadoGravadorSchema.omit({ serie: true, ultimoErro: true, erros: true, boot: true }).extend({
  ultimoErro: erroSalvoSchema.nullable(),
  /** Do mais novo para o mais antigo. */
  erros: z.array(erroSalvoSchema),
  boot: z.object({ motivo: z.string(), em: z.string() }),
});
export type EstadoSalvo = z.infer<typeof estadoSalvoSchema>;

/**
 * Resposta para a placa: a empresa que recebe as notas, ou `null` com o motivo
 * (aguardando aprovação, sem empresa); e se o envio está pausado — aí as
 * gravações esperam no cartão.
 */
export const respostaEstadoSchema = z.object({
  destino: z.object({ id: z.string(), nome: z.string() }).nullable(),
  aviso: z.string().nullable(),
  pausado: z.boolean(),
});
export type RespostaEstado = z.infer<typeof respostaEstadoSchema>;

/** Uma placa na tela de Configurações › Gravadores. */
export const gravadorSchema = z.object({
  id: z.string(),
  serie: z.string(),
  nome: z.string(),
  /** Falso enquanto aguarda aprovação: a placa se apresentou, mas ainda não manda notas. */
  aprovado: z.boolean(),
  destino: z.object({ id: z.string(), nome: z.string() }).nullable(),
  /** Pausado no Noteless: a placa não envia, as gravações esperam no cartão. */
  envioPausado: z.boolean(),
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
    envioPausado: z.boolean().optional(),
  })
  .refine((v) => v.nome !== undefined || v.organizationId !== undefined || v.envioPausado !== undefined, "Nada para mudar.");
export type MudarGravadorInput = z.infer<typeof mudarGravadorSchema>;

/** Aprovar a placa: o código que ela mostra na página de Wi-Fi, a empresa e, se quiser, outro nome. */
export const aprovarGravadorSchema = z.object({
  codigo: z.string().trim().min(1, "Digite o código que o gravador mostra."),
  organizationId: z.string().min(1, "Escolha a empresa."),
  nome: z.string().trim().min(1, "Dê um nome ao gravador.").max(60, "Nome longo demais.").optional(),
});
export type AprovarGravadorInput = z.infer<typeof aprovarGravadorSchema>;

/** Código como foi digitado → como comparar: "k7f 3qx" e "K7F-3QX" são o mesmo. */
export function normalizarCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function gravadorOnline(vistoEm: Date | string, agora = new Date()): boolean {
  return agora.getTime() - new Date(vistoEm).getTime() <= GRAVADOR_ONLINE_SEG * 1000;
}

/** Força do Wi-Fi para quem não lê dBm. Abaixo de -80, o envio já falhou na prática. */
export function sinalEmPalavras(dbm: number): "bom" | "fraco" | "muito fraco" {
  if (dbm >= -67) return "bom";
  if (dbm >= -80) return "fraco";
  return "muito fraco";
}

/**
 * O que a tela diz da fila. Com o cartão com problema, a placa não consegue ler
 * a fila: o número é o último que ela viu, e "tudo enviado" seria mentira.
 */
export function filaEmPalavras(e: Pick<EstadoSalvo, "fila" | "cartao">, curta = false): string {
  if (!e.cartao.ok) return curta ? "Não dá para ler" : "Não dá para ler (cartão com problema)";
  if (e.fila === 0) return "Tudo enviado";
  return curta ? `${e.fila} esperando` : `${e.fila} esperando para subir`;
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
