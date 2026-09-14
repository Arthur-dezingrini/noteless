import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./server";

/**
 * Data Access Layer da sessão.
 *
 * O guia de autenticação do Next é explícito: a checagem no proxy é otimista
 * (só lê o cookie) e não serve como única defesa. Toda página ou action que
 * dependa de identidade chama daqui, o mais perto possível dos dados.
 *
 * O `cache` do React deduplica a consulta dentro de um mesmo render.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Igual ao acima, mas manda para o login quem não estiver autenticado. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
