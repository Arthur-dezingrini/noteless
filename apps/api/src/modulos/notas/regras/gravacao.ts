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
