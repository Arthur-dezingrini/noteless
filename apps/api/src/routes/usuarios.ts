import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  papelSchema,
  vincularUsuarioSchema,
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

  // Cadastrar cria conta nova. Se o e-mail já existe, a pessoa foi criada por
  // outra organização — o caminho certo é "Vincular", que não mexe na senha.
  try {
    const novo = await criarUsuario(body.data);
    await auth.api.addMember({
      body: { userId: novo.id, organizationId: orgId, role: body.data.role },
    });
    return c.json({ id: novo.id }, 201);
  } catch (e) {
    if (e instanceof UsuarioJaExiste) {
      return c.json(
        { error: "Já existe uma conta com esse e-mail. Use \"Vincular usuário\" para trazê-la a esta organização." },
        409,
      );
    }
    throw e;
  }
});

/**
 * Vincula à organização alguém que já tem conta. Um usuário pode pertencer a
 * várias organizações; senha e nome ficam como estão — só o dono da conta muda.
 */
usuariosRoutes.post("/:orgId/usuarios/vincular", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu || !PODE_GERENCIAR.includes(eu.role)) {
    return c.json({ error: "Só administradores podem vincular usuários." }, 403);
  }

  const body = vincularUsuarioSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const ctx = await auth.$context;
  const existente = await ctx.internalAdapter.findUserByEmail(body.data.email.toLowerCase());
  if (!existente) {
    return c.json(
      { error: "Não existe conta com esse e-mail. Use \"Cadastrar usuário\" para criar uma." },
      404,
    );
  }

  const [jaMembro] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, existente.user.id), eq(member.organizationId, orgId)))
    .limit(1);
  if (jaMembro) return c.json({ error: "Essa pessoa já faz parte desta organização." }, 409);

  await auth.api.addMember({
    body: { userId: existente.user.id, organizationId: orgId, role: body.data.role },
  });
  return c.json({ id: existente.user.id, name: existente.user.name }, 201);
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
    .select({ memberId: member.id, role: member.role, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.userId, alvoId), eq(member.organizationId, orgId)))
    .limit(1);
  if (!alvo) return c.json({ error: "Usuário não encontrado nesta organização." }, 404);

  // O papel do dono não se mexe por aqui — evita a organização ficar sem dono.
  if (body.data.role && alvo.role === "owner") {
    return c.json({ error: "O papel do dono da organização não pode ser alterado." }, 400);
  }

  const ctx = await auth.$context;
  const email = body.data.email?.trim().toLowerCase();
  if (email && email !== alvo.email) {
    const existente = await ctx.internalAdapter.findUserByEmail(email);
    if (existente && existente.user.id !== alvoId) {
      return c.json({ error: `Já existe um usuário com o e-mail ${email}.` }, 409);
    }
  }

  if (body.data.name !== undefined || body.data.cargo !== undefined || email) {
    await ctx.internalAdapter.updateUser(alvoId, {
      ...(body.data.name !== undefined && { name: body.data.name }),
      ...(body.data.cargo !== undefined && { cargo: body.data.cargo }),
      ...(email && email !== alvo.email && { email, emailVerified: false }),
    });
  }

  if (body.data.password) {
    const conta = await ctx.internalAdapter.findCredentialAccount(alvoId);
    if (!conta) return c.json({ error: "Conta de acesso não encontrada." }, 404);
    await ctx.internalAdapter.updateAccount(conta.id, {
      password: await ctx.password.hash(body.data.password),
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
