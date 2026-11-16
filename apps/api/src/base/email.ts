import { env } from "../env";

/**
 * E-mail pela api HTTP da Resend, sem biblioteca. Serve aos alertas e, depois,
 * ao convite e ao "esqueci a senha". Nunca lança: quem chama segue em frente.
 */
export type Email = { para: string[]; assunto: string; texto: string };

type Opcoes = { chave?: string; remetente?: string; fetch?: typeof fetch };

const RESEND = "https://api.resend.com/emails";

export async function enviarEmail(email: Email, opcoes: Opcoes = {}): Promise<{ enviado: boolean }> {
  const chave = opcoes.chave ?? env.RESEND_API_KEY;
  if (!chave || email.para.length === 0) return { enviado: false };
  const enviar = opcoes.fetch ?? fetch;
  try {
    const res = await enviar(RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: opcoes.remetente ?? env.EMAIL_REMETENTE,
        to: email.para,
        subject: email.assunto,
        text: email.texto,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const motivo = await res.text().catch(() => "");
      console.error(`[email] a Resend recusou (${res.status}):`, motivo.slice(0, 300));
      return { enviado: false };
    }
    return { enviado: true };
  } catch (e) {
    console.error("[email] falha ao enviar:", e);
    return { enviado: false };
  }
}
