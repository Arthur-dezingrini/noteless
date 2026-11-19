import { enviarEmail } from "../../../base/email";
import { env } from "../../../env";

/**
 * Manda o link de "esqueci a senha". O Better Auth chama isto depois de gravar
 * o token (válido por 1 hora, uso único); para quem pediu, a resposta é a
 * mesma exista a conta ou não.
 */
export async function enviarLinkDeSenha(pessoa: { name: string; email: string }, link: string): Promise<void> {
  const { enviado } = await enviarEmail({
    para: [pessoa.email],
    assunto: "Redefinição de senha do Noteless",
    texto: [
      `Olá, ${pessoa.name}.`,
      "",
      "Recebemos um pedido para criar uma senha nova para a sua conta no Noteless. Abra o link abaixo para escolher a senha nova. Ele vale por 1 hora e só pode ser usado uma vez.",
      "",
      link,
      "",
      "Se você não fez esse pedido, ignore este e-mail: a sua senha atual continua valendo.",
    ].join("\n"),
  });
  if (enviado) return;
  if (env.NODE_ENV === "production") {
    // O link nunca vai para o log de produção: quem lesse o log trocaria a senha da pessoa.
    console.error("[senha] link de redefinição não enviado: confira RESEND_API_KEY e EMAIL_REMETENTE");
  } else {
    console.log(`[senha] e-mail não configurado; link de redefinição para ${pessoa.email}: ${link}`);
  }
}
