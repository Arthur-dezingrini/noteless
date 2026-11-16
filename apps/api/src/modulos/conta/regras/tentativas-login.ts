import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "../../../db";
import { verification } from "../../../db/schema";

/**
 * Freio contra adivinhar senha: falhas seguidas de login num mesmo e-mail
 * bloqueiam esse e-mail por um tempo, exista a conta ou não (a resposta é a
 * mesma, para não entregar quais e-mails existem).
 *
 * Conta por e-mail, não por IP: atrás do rewrite do web a api não recebe um
 * IP de cliente confiável, e o limitador do Better Auth guarda a contagem na
 * memória de cada instância — na Vercel, cada uma conta a sua. Aqui a
 * contagem fica no banco e vale para todas.
 *
 * Mora na tabela `verification` do próprio Better Auth (valores curtos com
 * prazo), com um id só nosso: não precisa de migração.
 */
export const MAXIMO_FALHAS = 10;
export const JANELA_MS = 15 * 60 * 1000;

const IDENTIFICADOR = "tentativas-login";
const idDe = (email: string) => `${IDENTIFICADOR}:${email.trim().toLowerCase()}`;

// No ON CONFLICT, a linha que já existe se chama pelo nome da tabela.
const atual = (coluna: string) => sql.raw(`"verification"."${coluna}"`);

/** Segundos até poder tentar de novo, ou `null` se pode tentar agora. */
export async function esperaParaEntrar(email: string, agora = new Date()): Promise<number | null> {
  const [r] = await db
    .select({ value: verification.value, expiresAt: verification.expiresAt })
    .from(verification)
    .where(eq(verification.id, idDe(email)))
    .limit(1);
  if (!r || r.expiresAt <= agora || Number(r.value) < MAXIMO_FALHAS) return null;
  return Math.ceil((r.expiresAt.getTime() - agora.getTime()) / 1000);
}

/**
 * Mais uma falha. A janela começa na primeira; vencida, a contagem recomeça.
 * Um comando só: duas falhas ao mesmo tempo, em instâncias diferentes,
 * contam duas.
 */
export async function registrarFalha(email: string, agora = new Date()) {
  const venceu = sql`${atual("expires_at")} <= ${sql.param(agora, verification.expiresAt)}`;
  await db
    .insert(verification)
    .values({
      id: idDe(email),
      identifier: IDENTIFICADOR,
      value: "1",
      expiresAt: new Date(agora.getTime() + JANELA_MS),
      createdAt: agora,
      updatedAt: agora,
    })
    .onConflictDoUpdate({
      target: verification.id,
      set: {
        value: sql`case when ${venceu} then '1' else (${atual("value")}::int + 1)::text end`,
        expiresAt: sql`case when ${venceu} then excluded."expires_at" else ${atual("expires_at")} end`,
        updatedAt: agora,
      },
    });

  // Faxina: contagens vencidas de qualquer e-mail.
  await db.delete(verification).where(and(eq(verification.identifier, IDENTIFICADOR), lt(verification.expiresAt, agora)));
}

/** Entrou: as falhas anteriores deixam de contar. */
export async function zerarFalhas(email: string) {
  await db.delete(verification).where(eq(verification.id, idDe(email)));
}

/**
 * Envolve o login por e-mail e senha do Better Auth: recusa (429) o e-mail
 * bloqueado sem nem conferir a senha, conta a falha (401) e zera no acerto.
 */
export async function protegerLogin(req: Request, entrar: (req: Request) => Promise<Response>): Promise<Response> {
  const corpo = (await req
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null;
  const email = typeof corpo?.email === "string" && corpo.email.trim() ? corpo.email : null;

  if (email) {
    const espera = await esperaParaEntrar(email);
    if (espera !== null) {
      const minutos = Math.ceil(espera / 60);
      return Response.json(
        {
          code: "MUITAS_TENTATIVAS",
          message: `Muitas tentativas erradas com este e-mail. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
        },
        { status: 429, headers: { "Retry-After": String(espera) } },
      );
    }
  }

  const res = await entrar(req);
  if (email) {
    if (res.status === 401) await registrarFalha(email);
    else if (res.ok) await zerarFalhas(email);
  }
  return res;
}
