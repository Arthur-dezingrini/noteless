import { auth } from "../auth";

/**
 * Super usuário logado, ou `null` (sem sessão ou tipo comum). Guarda das rotas
 * /api/admin: vale para a plataforma inteira, não para uma empresa.
 */
export async function superUsuario(headers: Headers): Promise<{ userId: string } | null> {
  const s = await auth.api.getSession({ headers });
  if (!s) return null;
  return (s.user as { tipo?: string | null }).tipo === "super" ? { userId: s.user.id } : null;
}
