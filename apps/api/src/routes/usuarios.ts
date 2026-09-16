import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  papelSchema,
  type Papel,
  type Usuario,
} from "@vocare/shared";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import { auth } from "../auth";
import { db } from "../db";
import { member, user } from "../db/schema";
import { membroAtual } from "../membros/membro-atual";
import { criarUsuario, UsuarioJaExiste } from "../usuarios/criar-usuario";

/**
 * Administração de usuários de uma organização.
 *
 * O Better Auth já sabe convidar por e-mail, mas não temos envio de e-mail
 * ainda. Aqui o administrador cria a pessoa direto, com senha temporária, e
 * ela já entra como membro. Papéis e remoção passam pela api do Better Auth
 * (com o cookie do chamador), então as regras dele continuam valendo.
 */
export const usuariosRoutes = new Hono();

const PODE_GERENCIAR: Papel[] = ["owner", "admin"];

async function listar(organizationId: string): Promise<Usuario[]> {
  const rows = await db
    .select({
      id: user.id,
      memberId: member.id,
      name: user.name,
      email: user.email,
      cargo: user.cargo,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(member.createdAt));

  return rows.map((r) => ({
    ...r,
    role: papelSchema.catch("member").parse(r.role),
  }));
}

usuariosRoutes.get("/:orgId/usuarios", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  return c.json(await listar(orgId));
});

usuariosRoutes.post("/:orgId/usuarios", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu || !PODE_GERENCIAR.includes(eu.role)) {
    return c.json({ error: "Só administradores podem adicionar usuários." }, 403);
  }

  const body = criarUsuarioSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  try {
    const novo = await criarUsuario(body.data);
    await auth.api.addMember({
      body: { userId: novo.id, organizationId: orgId, role: body.data.role },
    });
    return c.json({ id: novo.id }, 201);
  } catch (e) {
    if (e instanceof UsuarioJaExiste) return c.json({ error: e.message }, 409);
    throw e;
  }
});

usuariosRoutes.patch("/:orgId/usuarios/:userId", async (c) => {
  const orgId = c.req.param("orgId");
  const alvoId = c.req.param("userId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu || !PODE_GERENCIAR.includes(eu.role)) {
    return c.json({ error: "Só administradores podem editar usuários." }, 403);
  }

  const body = atualizarUsuarioSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const [alvo] = await db
    .select({ memberId: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.userId, alvoId), eq(member.organizationId, orgId)))
    .limit(1);
  if (!alvo) return c.json({ error: "Usuário não encontrado nesta organização." }, 404);

  // O papel do dono não se mexe por aqui — evita a organização ficar sem dono.
  if (body.data.role && alvo.role === "owner") {
    return c.json({ error: "O papel do dono da organização não pode ser alterado." }, 400);
  }

  const ctx = await auth.$context;
  if (body.data.name !== undefined || body.data.cargo !== undefined) {
    await ctx.internalAdapter.updateUser(alvoId, {
      ...(body.data.name !== undefined && { name: body.data.name }),
      ...(body.data.cargo !== undefined && { cargo: body.data.cargo }),
    });
  }

  if (body.data.role && body.data.role !== alvo.role) {
    await auth.api.updateMemberRole({
      body: { memberId: alvo.memberId, role: body.data.role, organizationId: orgId },
      headers: c.req.raw.headers,
    });
  }

  return c.json({ ok: true });
});

usuariosRoutes.delete("/:orgId/usuarios/:userId", async (c) => {
  const orgId = c.req.param("orgId");
  const alvoId = c.req.param("userId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu || !PODE_GERENCIAR.includes(eu.role)) {
    return c.json({ error: "Só administradores podem remover usuários." }, 403);
  }
  if (alvoId === eu.userId) {
    return c.json({ error: "Você não pode remover a si mesmo." }, 400);
  }

  const [alvo] = await db
    .select({ memberId: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.userId, alvoId), eq(member.organizationId, orgId)))
    .limit(1);
  if (!alvo) return c.json({ error: "Usuário não encontrado nesta organização." }, 404);
  if (alvo.role === "owner") {
    return c.json({ error: "O dono da organização não pode ser removido." }, 400);
  }

  // Remove a filiação, não a conta: a pessoa pode pertencer a outras
  // organizações. Sem nenhuma, ela simplesmente não vê nada ao entrar.
  await auth.api.removeMember({
    body: { memberIdOrEmail: alvo.memberId, organizationId: orgId },
    headers: c.req.raw.headers,
  });

  return c.json({ ok: true });
});
