import { z } from "zod";

const ADIANTADO_MAX_MS = 5 * 60 * 1000;
const IDADE_MAX_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Hora em que o áudio foi gravado, quando chega depois (gravador sem sinal
 * guarda no cartão e envia quando o Wi-Fi volta). Valor estranho — relógio
 * da placa zerado ou adiantado, texto inválido — é ignorado em vez de
 * recusar: perder a gravação é pior; vale a hora da chegada.
 */
export function quandoFoiGravado(valor: unknown, agora = new Date()): Date | null {
  const iso = z.iso.datetime({ offset: true }).safeParse(valor);
  if (!iso.success) return null;
  const quando = new Date(iso.data);
  const t = quando.getTime();
  if (t > agora.getTime() + ADIANTADO_MAX_MS || t < agora.getTime() - IDADE_MAX_MS) return null;
  return quando;
}

/** "audio/wav", "audio/webm;codecs=opus"… O tipo vem de quem envia, então só passa o que é áudio de fato. */
const TIPO_AUDIO = /^audio\/[a-z0-9.+-]+(\s*;\s*[a-z0-9-]+=[a-z0-9.+-]+)*$/i;

/**
 * O tipo com que o áudio é guardado e devolvido para o player. Arquivo sem
 * tipo vale como webm (o que o navegador grava); tipo que não é de áudio
 * vira `null` — quem envia leva 415. Na leitura, um tipo antigo fora do
 * padrão sai como binário genérico: o navegador nunca o abre como página.
 */
export function tipoDeAudio(tipo: string | null | undefined): string | null {
  const t = (tipo ?? "").trim();
  if (!t) return "audio/webm";
  return TIPO_AUDIO.test(t) ? t.toLowerCase() : null;
}

/**
 * Nome para o áudio que chegou cru, sem nome de arquivo: a transcrição
 * reconhece o formato pela extensão.
 */
export function nomeDoAudio(mime: string): string {
  const formato = /^audio\/(?:x-)?([a-z0-9]+)/i.exec(mime.trim())?.[1] ?? "webm";
  return `gravacao.${formato.toLowerCase()}`;
}
