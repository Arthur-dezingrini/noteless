/**
 * De quanto em quanto tempo a tela aberta pergunta à api se chegou novidade
 * (ver components/app/ao-vivo.tsx).
 *
 * Cada pergunta é uma chamada na Vercel e uma consulta no Neon, então só se
 * pergunta com a aba visível, e devagar quando ninguém mexe na tela há um
 * tempo — um monitor esquecido ligado não gasta o plano do mês.
 */
export const AO_VIVO = {
  /** Alguém usando a tela. */
  ativoMs: 5_000,
  /** Tela parada (ninguém mexe há `ociosoAposMs`). */
  ociosoMs: 30_000,
  ociosoAposMs: 3 * 60_000,
};

/** Daqui a quanto tempo perguntar de novo; `null` = não perguntar (aba escondida). */
export function proximaVerificacao(visivel: boolean, msDesdeAtividade: number): number | null {
  if (!visivel) return null;
  return msDesdeAtividade < AO_VIVO.ociosoAposMs ? AO_VIVO.ativoMs : AO_VIVO.ociosoMs;
}

/** Mexer na tela depois de um tempo parada já pede uma verificação na hora. */
export function voltouDaOciosidade(msDesdeAtividade: number): boolean {
  return msDesdeAtividade >= AO_VIVO.ociosoAposMs;
}
