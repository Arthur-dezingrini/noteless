import { eq } from "drizzle-orm";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { organization, session } from "../../../db/schema";

/** Muda a empresa ativa desta sessão (uso do super usuário, que entra em qualquer uma). */
export async function trocarEmpresaAtiva(sessionId: string, organizationId: string): Promise<Resultado<void>> {
  const [o] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, organizationId)).limit(1);
  if (!o) return falha(404, "Empresa não encontrada.");
  await db.update(session).set({ activeOrganizationId: organizationId }).where(eq(session.id, sessionId));
  return ok(undefined);
}
