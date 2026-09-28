import { papelSchema } from "@vocare/shared";
import { and, eq } from "drizzle-orm";

import { auth } from "../auth";
import { db } from "../db";
import { member } from "../db/schema";

/**
 * Sessão + papel do chamador na organização da rota. `null` se não está
 * logado ou não é membro — toda rota de negócio começa por aqui.
 */
export async function membroAtual(headers: Headers, organizationId: string) {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const [m] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.userId, session.user.id), eq(member.organizationId, organizationId)))
    .limit(1);
  if (!m) return null;

  const role = papelSchema.safeParse(m.role);
  return {
    userId: session.user.id,
    nome: session.user.name || session.user.email,
    memberId: m.id,
    role: role.success ? role.data : ("member" as const),
  };
}
