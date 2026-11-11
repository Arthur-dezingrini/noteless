import { papelSchema, type Papel } from "@vocare/shared";
import { and, eq } from "drizzle-orm";

import { auth } from "../auth";
import { db } from "../db";
import { member, organization } from "../db/schema";

export type MembroAtual = {
  userId: string;
  nome: string;
  /** `null` quando é super usuário sem vínculo com a empresa. */
  memberId: string | null;
  role: Papel;
};

/**
 * Sessão + papel do chamador na organização da rota. `null` se não está
 * logado ou não tem acesso — toda rota de negócio começa por aqui.
 *
 * Super usuário entra em qualquer empresa que exista, como dono, mesmo sem
 * vínculo (regra do Arthur: ele administra a plataforma inteira).
 */
export async function membroAtual(headers: Headers, organizationId: string): Promise<MembroAtual | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const nome = session.user.name || session.user.email;

  const [m] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.userId, session.user.id), eq(member.organizationId, organizationId)))
    .limit(1);
  if (m) {
    const role = papelSchema.safeParse(m.role);
    return { userId: session.user.id, nome, memberId: m.id, role: role.success ? role.data : "member" };
  }

  if ((session.user as { tipo?: string | null }).tipo !== "super") return null;
  const [o] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, organizationId)).limit(1);
  return o ? { userId: session.user.id, nome, memberId: null, role: "owner" } : null;
}
