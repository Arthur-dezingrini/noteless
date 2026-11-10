import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "../db";
import { notificacao } from "../db/tabelas/avisos";
import { member } from "../db/schema";

type Aviso = { texto: string; detalhe?: string | null; link?: string | null };

/**
 * Grava um aviso para cada usuário. Falhar aqui nunca derruba a operação que
 * gerou o aviso — notificação é conveniência, não regra de negócio.
 */
export async function notificar(orgId: string, userIds: (string | null | undefined)[], aviso: Aviso) {
  const ids = [...new Set(userIds.filter((u): u is string => !!u))];
  if (ids.length === 0) return;
  try {
    await db.insert(notificacao).values(
      ids.map((userId) => ({ organizationId: orgId, userId, texto: aviso.texto, detalhe: aviso.detalhe ?? null, link: aviso.link ?? null })),
    );
  } catch (e) {
    console.error("[notificacoes] falha ao gravar aviso:", e);
  }
}

/** Administradores (owner/admin) da organização, menos quem causou o aviso. */
export async function administradores(orgId: string, exceto?: string) {
  const filtros = [eq(member.organizationId, orgId), inArray(member.role, ["owner", "admin"])];
  if (exceto) filtros.push(ne(member.userId, exceto));
  const rows = await db.select({ id: member.userId }).from(member).where(and(...filtros));
  return rows.map((r) => r.id);
}
