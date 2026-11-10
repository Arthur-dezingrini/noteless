import {
  atualizarAnimalSchema,
  criarAnimalSchema,
  especieSchema,
  sexoSchema,
  statusAnimalSchema,
  type Animal,
  type CriarAnimalInput,
  type Papel,
} from "@vocare/shared";
import { and, asc, eq, gte, isNull, or } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../../../db";
import { animal } from "../../../db/tabelas/animais";
import { tratamento } from "../../../db/tabelas/historico";
import { membroAtual } from "../../../base/membro-atual";

/**
 * Cadastro de animais de uma organização. Qualquer membro cadastra e edita
 * (é o trabalho do dia a dia); remover fica com o administrador.
 */
export const animaisRoutes = new Hono();

const PODE_REMOVER: Papel[] = ["owner", "admin"];

/** Linha do banco → contrato. Texto livre no banco vira enum validado aqui. */
export function paraContrato(r: typeof animal.$inferSelect, emTratamento?: boolean): Animal {
  return {
    id: r.id,
    numero: r.numero,
    nome: r.nome,
    especie: especieSchema.catch("outro").parse(r.especie),
    raca: r.raca,
    sexo: r.sexo === null ? null : sexoSchema.catch("macho").parse(r.sexo),
    nascimento: r.nascimento,
    pesoKg: r.pesoKg === null ? null : Number(r.pesoKg),
    tutor: r.tutor,
    tutorTelefone: r.tutorTelefone,
    microchip: r.microchip,
    local: r.local,
    ultimaVisita: r.ultimaVisita,
    status: statusAnimalSchema.catch("ativo").parse(r.status),
    emTratamento,
    createdAt: r.createdAt,
  };
}

/** Contrato → colunas. `numeric` no drizzle é string; o resto bate 1:1. */
function paraColunas(d: CriarAnimalInput) {
  return {
    numero: d.numero || null,
    // Animal só com número: nome fica vazio e a tela mostra "nº 47".
    nome: d.nome ?? "",
    especie: d.especie,
    raca: d.raca ?? null,
    sexo: d.sexo ?? null,
    nascimento: d.nascimento ?? null,
    pesoKg: d.pesoKg == null ? null : String(d.pesoKg),
    tutor: d.tutor ?? null,
    tutorTelefone: d.tutorTelefone ?? null,
    microchip: d.microchip || null,
    local: d.local || null,
    ultimaVisita: d.ultimaVisita ?? null,
  };
}

animaisRoutes.get("/:orgId/animais", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [rows, tratando] = await Promise.all([
    db.select().from(animal).where(eq(animal.organizationId, orgId)).orderBy(asc(animal.numero), asc(animal.nome)),
    // Em tratamento = tem remédio cujo fim ainda não passou (ou sem fim definido).
    db
      .selectDistinct({ id: tratamento.animalId })
      .from(tratamento)
      .where(and(eq(tratamento.organizationId, orgId), or(isNull(tratamento.fim), gte(tratamento.fim, hoje)))),
  ]);
  const emTratamento = new Set(tratando.map((t) => t.id));

  return c.json(rows.map((r) => paraContrato(r, emTratamento.has(r.id))));
});

animaisRoutes.post("/:orgId/animais", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = criarAnimalSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const [novo] = await db
    .insert(animal)
    .values({ organizationId: orgId, ...paraColunas(body.data) })
    .returning({ id: animal.id });

  return c.json({ id: novo!.id }, 201);
});

animaisRoutes.patch("/:orgId/animais/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = atualizarAnimalSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  // O filtro por organização é a garantia de que ninguém edita animal alheio.
  const [alvo] = await db
    .update(animal)
    .set({ ...paraColunas(body.data), status: body.data.status })
    .where(and(eq(animal.id, id), eq(animal.organizationId, orgId)))
    .returning({ id: animal.id });
  if (!alvo) return c.json({ error: "Animal não encontrado." }, 404);

  return c.json({ ok: true });
});

animaisRoutes.delete("/:orgId/animais/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu || !PODE_REMOVER.includes(eu.role)) {
    return c.json({ error: "Só administradores podem remover animais." }, 403);
  }

  const [alvo] = await db
    .delete(animal)
    .where(and(eq(animal.id, id), eq(animal.organizationId, orgId)))
    .returning({ id: animal.id });
  if (!alvo) return c.json({ error: "Animal não encontrado." }, 404);

  return c.json({ ok: true });
});
