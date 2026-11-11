import type { CriarVinculoInput, Papel, TipoUsuario } from "@vocare/shared";
import { and, count, eq, like } from "drizzle-orm";

import { auth } from "../../../auth";
import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { member, organization, user } from "../../../db/schema";
import { papelPrincipal } from "../consultas/admin";

const SEM_DONO = "A empresa ficaria sem dono.";
const SEM_VINCULO = "Vínculo não encontrado.";

/** Quantos donos a empresa tem (papel "owner", sozinho ou junto de outro). */
async function donos(organizationId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), like(member.role, "%owner%")));
  return r?.n ?? 0;
}

async function acharVinculo(memberId: string) {
  const [v] = await db.select().from(member).where(eq(member.id, memberId)).limit(1);
  return v ?? null;
}

/** Liga a pessoa à empresa com o papel escolhido. */
export async function vincular({ userId, organizationId, papel }: CriarVinculoInput): Promise<Resultado<{ memberId: string }>> {
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return falha(404, "Usuário não encontrado.");
  const [o] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, organizationId)).limit(1);
  if (!o) return falha(404, "Empresa não encontrada.");
  const [ja] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
    .limit(1);
  if (ja) return falha(409, "Essa pessoa já está nessa empresa.");

  // Pelo Better Auth (sem cabeçalho = chamada do servidor), como o resto dos vínculos.
  const novo = await auth.api.addMember({ body: { userId, organizationId, role: papel } });
  return ok({ memberId: novo!.id });
}

export async function mudarPapel(memberId: string, papel: Papel): Promise<Resultado<void>> {
  const v = await acharVinculo(memberId);
  if (!v) return falha(404, SEM_VINCULO);
  if (papelPrincipal(v.role) === "owner" && papel !== "owner" && (await donos(v.organizationId)) <= 1) return falha(422, SEM_DONO);
  await db.update(member).set({ role: papel }).where(eq(member.id, memberId));
  return ok(undefined);
}

export async function desvincular(memberId: string): Promise<Resultado<void>> {
  const v = await acharVinculo(memberId);
  if (!v) return falha(404, SEM_VINCULO);
  if (papelPrincipal(v.role) === "owner" && (await donos(v.organizationId)) <= 1) return falha(422, SEM_DONO);
  await db.delete(member).where(eq(member.id, memberId));
  return ok(undefined);
}

/** Marca ou desmarca super usuário; nunca deixa a plataforma sem nenhum. */
export async function mudarTipo(userId: string, tipo: TipoUsuario): Promise<Resultado<void>> {
  const [u] = await db.select({ tipo: user.tipo }).from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return falha(404, "Usuário não encontrado.");
  if (u.tipo === "super" && tipo !== "super") {
    const [r] = await db.select({ n: count() }).from(user).where(eq(user.tipo, "super"));
    if ((r?.n ?? 0) <= 1) return falha(422, "Precisa sobrar pelo menos um super usuário.");
  }
  await db.update(user).set({ tipo }).where(eq(user.id, userId));
  return ok(undefined);
}
