import "server-only";

import { headers } from "next/headers";

/**
 * Chamada servidor→api com a identidade do usuário atual.
 *
 * O navegador fala com a api pelos rewrites do Next; aqui, dentro de Server
 * Components e Server Actions, não existe rewrite — falamos direto com a api e
 * repassamos o cookie de sessão que veio do navegador.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const cookie = (await headers()).get("cookie") ?? "";
  // Lido a cada chamada: na Vercel o API_URL é o endereço interno da api,
  // injetado só em tempo de execução (binding no vercel.json).
  const base = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...init.headers, cookie },
    // Sessão nunca pode vir de cache.
    cache: "no-store",
  });
}
