import type { Empresa, Papel, UsuarioAdmin } from "@vocare/shared";
import { asc, eq, ilike, or } from "drizzle-orm";

import { db } from "../../../db";
import { member, organization, user } from "../../../db/schema";

/** O Better Auth guarda papéis separados por vírgula ("admin,owner"): vale o mais alto. */
export function papelPrincipal(role: string): Papel {
  const papeis = role.split(",").map((r) => r.trim());
  if (papeis.includes("owner")) return "owner";
  if (papeis.includes("admin")) return "admin";
  return "member";
}

/** Todos os usuários da plataforma, com as empresas e o papel em cada uma. */
export async function listarUsuariosAdmin(busca?: string): Promise<UsuarioAdmin[]> {
  const termo = busca?.trim();
  const linhas = await db
    .select({
      id: user.id,
      nome: user.name,
      email: user.email,
      cargo: user.cargo,
      tipo: user.tipo,
      memberId: member.id,
      organizationId: organization.id,
      empresa: organization.name,
      role: member.role,
    })
    .from(user)
    .leftJoin(member, eq(member.userId, user.id))
    .leftJoin(organization, eq(organization.id, member.organizationId))
    .where(termo ? or(ilike(user.name, `%${termo}%`), ilike(user.email, `%${termo}%`)) : undefined)
    .orderBy(asc(user.name), asc(organization.name));

  const porId = new Map<string, UsuarioAdmin>();
  for (const l of linhas) {
    let u = porId.get(l.id);
    if (!u) {
      u = { id: l.id, nome: l.nome, email: l.email, cargo: l.cargo, tipo: l.tipo === "super" ? "super" : "comum", vinculos: [] };
      porId.set(l.id, u);
    }
    if (l.memberId && l.organizationId && l.empresa && l.role) {
      u.vinculos.push({ memberId: l.memberId, organizationId: l.organizationId, empresa: l.empresa, papel: papelPrincipal(l.role) });
    }
  }
  return [...porId.values()];
}

/** Todas as empresas (organizations) da plataforma. */
export async function listarEmpresas(): Promise<Empresa[]> {
  return db.select({ id: organization.id, nome: organization.name }).from(organization).orderBy(asc(organization.name));
}

/** Todas as empresas, como o Better Auth lista em /organization/list. */
export async function listarOrganizacoes() {
  return db
    .select({ id: organization.id, name: organization.name, slug: organization.slug, logo: organization.logo, metadata: organization.metadata, createdAt: organization.createdAt })
    .from(organization)
    .orderBy(asc(organization.name));
}
