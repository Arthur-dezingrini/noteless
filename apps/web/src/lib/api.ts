import "server-only";

import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Chamada servidor→api com a identidade do usuário atual.
 *
 * O navegador fala com a api pelos rewrites do Next; aqui, dentro de Server
 * Components e Server Actions, não existe rewrite — falamos direto com a api e
 * repassamos o cookie de sessão que veio do navegador.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const cookie = (await headers()).get("cookie") ?? "";

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, cookie },
    // Sessão nunca pode vir de cache.
    cache: "no-store",
  });
}
