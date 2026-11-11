import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  papelSchema,
  type Papel,
  type Usuario,
} from "@vocare/shared";
import { and, asc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";

import { auth } from "../../../auth";
import { db } from "../../../db";
import { member, user } from "../../../db/schema";
import { membroAtual } from "../../../base/membro-atual";
import { criarUsuario, UsuarioJaExiste } from "../regras/criar-usuario";

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

/** O Better Auth guarda mais de um papel separado por vírgula ("admin,owner"). */
function ehDono(role: string) {
  return role.split(",").some((r) => r.trim() === "owner");
}

/**
 * Senha e e-mail são da conta, não do vínculo: valem em todas as organizações
 * da pessoa. Por isso o administrador só troca os de quem está apenas nesta
 * organização e não é o dono — senão bastaria vincular alguém pelo e-mail para
 * tomar a conta dele na outra fazenda. Devolve por que não pode, ou `null`.
 */
async function motivoParaNaoTrocarAcesso(alvoId: string, orgId: string, role: string) {
  if (ehDono(role)) return "Senha e e-mail do dono da organização só podem ser trocados pelo próprio dono.";

  const [outra] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, alvoId), ne(member.organizationId, orgId)))
    .limit(1);
  if (outra) return "Essa pessoa também participa de outra organização; só ela pode trocar a senha e o e-mail.";

  return null;
}

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
  if (body.data.role && ehDono(alvo.role)) {
    return c.json({ error: "O papel do dono da organização não pode ser alterado." }, 400);
  }

  // A tela sempre manda o e-mail de volta; só conta como troca se mudou.
  const email = body.data.email?.trim().toLowerCase();
  const mudouEmail = email !== undefined && email !== alvo.email.toLowerCase();

  // Antes de gravar qualquer coisa: recusado é recusado inteiro.
  if ((mudouEmail || body.data.password) && alvoId !== eu.userId) {
    const motivo = await motivoParaNaoTrocarAcesso(alvoId, orgId, alvo.role);
    if (motivo) return c.json({ error: motivo }, 403);
  }

  const ctx = await auth.$context;
  if (mudouEmail) {
    const existente = await ctx.internalAdapter.findUserByEmail(email);
    if (existente && existente.user.id !== alvoId) {
      return c.json({ error: `Já existe um usuário com o e-mail ${email}.` }, 409);
    }
  }

  if (body.data.name !== undefined || body.data.cargo !== undefined || mudouEmail) {
    await ctx.internalAdapter.updateUser(alvoId, {
      ...(body.data.name !== undefined && { name: body.data.name }),
      ...(body.data.cargo !== undefined && { cargo: body.data.cargo }),
      ...(mudouEmail && { email, emailVerified: false }),
    });
  }

  if (body.data.password) {
    const conta = await ctx.internalAdapter.findCredentialAccount(alvoId);
    if (!conta) return c.json({ error: "Conta de acesso não encontrada." }, 404);
    await ctx.internalAdapter.updateAccount(conta.id, {
      password: await ctx.password.hash(body.data.password),
    });
    // Senha nova encerra as sessões abertas: se a troca foi por celular perdido
    // ou senha vazada, quem estava dentro sai. Quem troca a própria fica nesta.
    if (alvoId === eu.userId) {
      await auth.api.revokeOtherSessions({ headers: c.req.raw.headers });
    } else {
      await ctx.internalAdapter.deleteUserSessions(alvoId);
    }
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
  if (ehDono(alvo.role)) {
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
