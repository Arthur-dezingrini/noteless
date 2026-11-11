import { auth } from "../auth";

/** Quem está logado, olhando a plataforma (não uma empresa): `null` sem sessão. */
export async function quemNaPlataforma(headers: Headers): Promise<{ userId: string; ehSuper: boolean } | null> {
  const s = await auth.api.getSession({ headers });
  if (!s) return null;
  return { userId: s.user.id, ehSuper: (s.user as { tipo?: string | null }).tipo === "super" };
}

/**
 * Super usuário logado, ou `null` (sem sessão ou tipo comum). Guarda das rotas
 * /api/admin: vale para a plataforma inteira, não para uma empresa.
 */
export async function superUsuario(headers: Headers): Promise<{ userId: string } | null> {
  const q = await quemNaPlataforma(headers);
  return q?.ehSuper ? { userId: q.userId } : null;
}
