import { ROTULO_TIPO_CONSULTA, criarGrupoSchema, tipoConsultaSchema, type Grupo, type Papel } from "@vocare/shared";
import { and, asc, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { animal } from "../db/animais";
import { consulta } from "../db/consultas";
import { grupo, grupoAnimal, tratamento, vacina } from "../db/historico";
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
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const ids = grupos.map((g) => g.id);
  const todosMembros = [...new Set(membros.map((m) => m.animalId))];

  // Próxima consulta de cada grupo e os registros em massa mais recentes dos
  // membros (vacina/remédio salvos de um áudio ficam um por animal).
  const [proximas, vacinas, tratamentos] = await Promise.all([
    db
      .select({ grupoId: consulta.grupoId, data: consulta.data, tipo: consulta.tipo, obs: consulta.observacoes })
      .from(consulta)
      .where(and(inArray(consulta.grupoId, ids), gte(consulta.data, hoje), ne(consulta.status, "cancelada")))
      .orderBy(asc(consulta.data), asc(consulta.hora)),
    todosMembros.length
      ? db
          .select({ animalId: vacina.animalId, nome: vacina.vacina, data: vacina.data })
          .from(vacina)
          .where(inArray(vacina.animalId, todosMembros))
          .orderBy(desc(vacina.data))
          .limit(500)
      : [],
    todosMembros.length
      ? db
          .select({ animalId: tratamento.animalId, nome: tratamento.remedio, data: tratamento.inicio })
          .from(tratamento)
          .where(inArray(tratamento.animalId, todosMembros))
          .orderBy(desc(tratamento.inicio))
          .limit(500)
      : [],
  ]);

  function ultimoRegistro(animais: Set<string>) {
    // Agrupa por (tipo, nome, data): "Vacina raiva em 2 animais · 28/09".
    const contagem = new Map<string, { texto: string; data: string; n: number }>();
    for (const [rotulo, lista] of [["Vacina", vacinas], ["Remédio", tratamentos]] as const) {
      for (const r of lista) {
        if (!animais.has(r.animalId)) continue;
        const chave = `${rotulo}|${r.nome.toLowerCase()}|${r.data}`;
        const atual = contagem.get(chave) ?? { texto: `${rotulo} ${r.nome}`, data: r.data, n: 0 };
        atual.n += 1;
        contagem.set(chave, atual);
      }
    }
    // Mais recente primeiro; no mesmo dia, o que atingiu mais animais.
    const [mais] = [...contagem.values()].sort((a, b) => (a.data !== b.data ? (a.data < b.data ? 1 : -1) : b.n - a.n));
    if (!mais) return null;
    return `${mais.texto} em ${mais.n} ${mais.n === 1 ? "animal" : "animais"} · ${mais.data === hoje ? "hoje" : dm(mais.data)}`;
  }

  return grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    descricao: g.descricao,
    especie: g.especie,
    local: g.local,
    animalIds: membros.filter((m) => m.grupoId === g.id).map((m) => m.animalId),
    proximo: (() => {
      const p = proximas.find((x) => x.grupoId === g.id);
      if (!p) return null;
      const tipo = ROTULO_TIPO_CONSULTA[tipoConsultaSchema.catch("outro").parse(p.tipo)];
      return `${p.obs || tipo} · ${p.data === hoje ? "hoje" : dm(p.data)}`;
    })(),
    ultimo: ultimoRegistro(new Set(membros.filter((m) => m.grupoId === g.id).map((m) => m.animalId))),
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
