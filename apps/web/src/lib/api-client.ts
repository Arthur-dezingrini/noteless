/**
 * Chamada do NAVEGADOR à api, pelo rewrite (/api/* → apps/api). O cookie de
 * sessão vai junto por ser same-origin. Devolve a mensagem de erro da api,
 * ou null em sucesso — quem chama só precisa mostrar a string.
 *
 * (Para chamadas do servidor do Next, use `apiFetch` em lib/api.ts.)
 */
export async function chamarApi(path: string, init: RequestInit = {}): Promise<string | null> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Não foi possível concluir. Tente de novo.";
}

/** Igual a `chamarApi`, mas devolve o corpo em caso de sucesso. */
export async function chamarApiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.ok && body) return { ok: true, data: body };
  return { ok: false, error: body?.error ?? "Não foi possível concluir. Tente de novo." };
}
