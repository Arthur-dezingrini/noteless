import { sessionSchema, type Session } from "@vocare/shared";
import { redirect } from "next/navigation";
import { cache } from "react";

import { apiFetch } from "@/lib/api";

/**
 * Data Access Layer da sessão.
 *
 * O guia de autenticação do Next é explícito: a checagem no proxy é otimista
 * (só lê o cookie) e não serve como única defesa. Toda página que dependa de
 * identidade chama daqui, e a resposta da api é validada contra o contrato
 * compartilhado — se o back mudar a forma da sessão, isto falha alto.
 *
 * O `cache` do React deduplica a consulta dentro de um mesmo render.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const res = await apiFetch("/api/auth/get-session");
  if (!res.ok) return null;

  const parsed = sessionSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
});

/** Igual ao acima, mas manda para o login quem não estiver autenticado. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
