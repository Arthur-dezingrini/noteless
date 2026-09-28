import { criarGrupoSchema, type Grupo, type Papel } from "@vocare/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { animal } from "../db/animais";
import { grupo, grupoAnimal } from "../db/historico";
import { membroAtual } from "../membros/membro-atual";

/**
 * Grupos de animais. Qualquer membro cria e edita (é manejo do dia a dia);
 * remover fica com o administrador, como nos animais.
 */
export const gruposRoutes = new Hono();

const PODE_REMOVER: Papel[] = ["owner", "admin"];

async function listar(orgId: string, id?: string): Promise<Grupo[]> {
  const filtros = [eq(grupo.organizationId, orgId)];
  if (id) filtros.push(eq(grupo.id, id));
  const grupos = await db.select().from(grupo).where(and(...filtros)).orderBy(asc(grupo.nome));
  if (grupos.length === 0) return [];
  const membros = await db
    .select({ grupoId: grupoAnimal.grupoId, animalId: grupoAnimal.animalId })
    .from(grupoAnimal)
    .where(inArray(grupoAnimal.grupoId, grupos.map((g) => g.id)));
  return grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    descricao: g.descricao,
    especie: g.especie,
    local: g.local,
    animalIds: membros.filter((m) => m.grupoId === g.id).map((m) => m.animalId),
    createdAt: g.createdAt,
  }));
}

/** Só animais da própria organização entram no grupo. */
async function animaisValidos(orgId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: animal.id })
    .from(animal)
    .where(and(eq(animal.organizationId, orgId), inArray(animal.id, [...new Set(ids)])));
  return rows.map((r) => r.id);
}

gruposRoutes.get("/:orgId/grupos", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);
  return c.json(await listar(orgId));
});

gruposRoutes.post("/:orgId/grupos", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = criarGrupoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const ids = await animaisValidos(orgId, body.data.animalIds);
  const id = await db.transaction(async (tx) => {
    const [novo] = await tx
      .insert(grupo)
      .values({
        organizationId: orgId,
        nome: body.data.nome,
        descricao: body.data.descricao ?? null,
        especie: body.data.especie || null,
        local: body.data.local || null,
      })
      .returning({ id: grupo.id });
    if (ids.length) await tx.insert(grupoAnimal).values(ids.map((animalId) => ({ grupoId: novo!.id, animalId })));
    return novo!.id;
  });

  const [pronto] = await listar(orgId, id);
  return c.json(pronto, 201);
});

gruposRoutes.patch("/:orgId/grupos/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = criarGrupoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const ids = await animaisValidos(orgId, body.data.animalIds);
  const achou = await db.transaction(async (tx) => {
    const [alvo] = await tx
      .update(grupo)
      .set({
        nome: body.data.nome,
        descricao: body.data.descricao ?? null,
        especie: body.data.especie || null,
        local: body.data.local || null,
      })
      .where(and(eq(grupo.id, id), eq(grupo.organizationId, orgId)))
      .returning({ id: grupo.id });
    if (!alvo) return false;
    // Membros: troca a lista inteira — o formulário manda o estado final.
    await tx.delete(grupoAnimal).where(eq(grupoAnimal.grupoId, id));
    if (ids.length) await tx.insert(grupoAnimal).values(ids.map((animalId) => ({ grupoId: id, animalId })));
    return true;
  });
  if (!achou) return c.json({ error: "Grupo não encontrado." }, 404);

  const [pronto] = await listar(orgId, id);
  return c.json(pronto);
});

gruposRoutes.delete("/:orgId/grupos/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);
  if (!PODE_REMOVER.includes(eu.role)) return c.json({ error: "Só o administrador remove grupos." }, 403);

  const [alvo] = await db
    .delete(grupo)
    .where(and(eq(grupo.id, id), eq(grupo.organizationId, orgId)))
    .returning({ id: grupo.id });
  if (!alvo) return c.json({ error: "Grupo não encontrado." }, 404);
  return c.json({ ok: true });
});
