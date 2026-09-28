import {
  atualizarConsultaSchema,
  criarConsultaSchema,
  especieSchema,
  statusConsultaSchema,
  tipoConsultaSchema,
  type Consulta,
} from "@vocare/shared";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { animal } from "../db/animais";
import { consulta, prontuario } from "../db/consultas";
import { grupo } from "../db/historico";
import { member, user } from "../db/schema";
import { membroAtual } from "../membros/membro-atual";

/**
 * Agenda: consultas de uma organização. Qualquer membro agenda, edita e
 * exclui — cancelar e remarcar é rotina de recepção, não de administrador.
 */
export const consultasRoutes = new Hono();

const colunas = {
  id: consulta.id,
  animalId: consulta.animalId,
  animalNumero: animal.numero,
  animalNome: animal.nome,
  animalEspecie: animal.especie,
  animalTutor: animal.tutor,
  animalLocal: animal.local,
  grupoId: consulta.grupoId,
  grupoNome: grupo.nome,
  grupoLocal: grupo.local,
  veterinarioId: consulta.veterinarioId,
  veterinarioNome: user.name,
  data: consulta.data,
  hora: consulta.hora,
  duracaoMin: consulta.duracaoMin,
  tipo: consulta.tipo,
  status: consulta.status,
  observacoes: consulta.observacoes,
  prontuarioId: prontuario.id,
  createdAt: consulta.createdAt,
};

type Linha = { [K in keyof typeof colunas]: (typeof colunas)[K]["_"]["data"] | null };

/** Linha do join → contrato. Texto livre no banco vira enum validado aqui. */
function paraContrato(r: Linha): Consulta {
  const deGrupo = !r.animalId && !!r.grupoId;
  return {
    id: r.id!,
    animalId: r.animalId,
    animalNumero: r.animalNumero,
    animalNome: (deGrupo ? r.grupoNome : r.animalNome) ?? "—",
    animalEspecie: deGrupo ? null : especieSchema.catch("outro").parse(r.animalEspecie),
    animalTutor: r.animalTutor,
    grupoId: r.grupoId,
    local: deGrupo ? r.grupoLocal : r.animalLocal,
    veterinarioId: r.veterinarioId,
    veterinarioNome: r.veterinarioNome,
    data: r.data!,
    hora: r.hora!,
    duracaoMin: r.duracaoMin ?? 30,
    tipo: tipoConsultaSchema.catch("outro").parse(r.tipo),
    status: statusConsultaSchema.catch("agendada").parse(r.status),
    observacoes: r.observacoes,
    prontuarioId: r.prontuarioId,
    createdAt: r.createdAt!,
  };
}

/**
 * Animal (ou grupo) e veterinário precisam pertencer à organização — sem isso
 * um id chutado no corpo ligaria uma consulta ao animal de outra fazenda.
 */
async function validarVinculos(
  orgId: string,
  animalId: string | null | undefined,
  grupoId: string | null | undefined,
  veterinarioId: string | null | undefined,
) {
  if (animalId) {
    const [a] = await db
      .select({ id: animal.id })
      .from(animal)
      .where(and(eq(animal.id, animalId), eq(animal.organizationId, orgId)))
      .limit(1);
    if (!a) return "Animal não encontrado nesta organização.";
  } else if (grupoId) {
    const [g] = await db
      .select({ id: grupo.id })
      .from(grupo)
      .where(and(eq(grupo.id, grupoId), eq(grupo.organizationId, orgId)))
      .limit(1);
    if (!g) return "Grupo não encontrado nesta organização.";
  }

  if (veterinarioId) {
    const [m] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, veterinarioId), eq(member.organizationId, orgId)))
      .limit(1);
    if (!m) return "Veterinário não faz parte desta organização.";
  }
  return null;
}

consultasRoutes.get("/:orgId/consultas", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  // Intervalo opcional (?de=AAAA-MM-DD&ate=AAAA-MM-DD); sem ele, tudo.
  const de = c.req.query("de");
  const ate = c.req.query("ate");
  const filtros = [eq(consulta.organizationId, orgId)];
  if (de) filtros.push(gte(consulta.data, de));
  if (ate) filtros.push(lte(consulta.data, ate));

  const rows = await db
    .select(colunas)
    .from(consulta)
    .leftJoin(animal, eq(animal.id, consulta.animalId))
    .leftJoin(grupo, eq(grupo.id, consulta.grupoId))
    .leftJoin(user, eq(user.id, consulta.veterinarioId))
    .leftJoin(prontuario, eq(prontuario.consultaId, consulta.id))
    .where(and(...filtros))
    .orderBy(asc(consulta.data), asc(consulta.hora));

  return c.json(rows.map(paraContrato));
});

consultasRoutes.post("/:orgId/consultas", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = criarConsultaSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const erro = await validarVinculos(orgId, body.data.animalId, body.data.grupoId, body.data.veterinarioId);
  if (erro) return c.json({ error: erro }, 400);

  const [nova] = await db
    .insert(consulta)
    .values({
      organizationId: orgId,
      // Animal tem prioridade: com os dois, a consulta é do animal.
      animalId: body.data.animalId || null,
      grupoId: body.data.animalId ? null : (body.data.grupoId ?? null),
      veterinarioId: body.data.veterinarioId ?? null,
      data: body.data.data,
      hora: body.data.hora,
      duracaoMin: body.data.duracaoMin,
      tipo: body.data.tipo,
      observacoes: body.data.observacoes ?? null,
    })
    .returning({ id: consulta.id });

  return c.json({ id: nova!.id }, 201);
});

consultasRoutes.patch("/:orgId/consultas/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = atualizarConsultaSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const erro = await validarVinculos(orgId, body.data.animalId, body.data.grupoId, body.data.veterinarioId);
  if (erro) return c.json({ error: erro }, 400);

  // O filtro por organização garante que ninguém edita consulta alheia.
  const [alvo] = await db
    .update(consulta)
    .set({
      // Animal tem prioridade: com os dois, a consulta é do animal.
      animalId: body.data.animalId || null,
      grupoId: body.data.animalId ? null : (body.data.grupoId ?? null),
      veterinarioId: body.data.veterinarioId ?? null,
      data: body.data.data,
      hora: body.data.hora,
      duracaoMin: body.data.duracaoMin,
      tipo: body.data.tipo,
      status: body.data.status,
      observacoes: body.data.observacoes ?? null,
    })
    .where(and(eq(consulta.id, id), eq(consulta.organizationId, orgId)))
    .returning({ id: consulta.id });
  if (!alvo) return c.json({ error: "Consulta não encontrada." }, 404);

  return c.json({ ok: true });
});

consultasRoutes.delete("/:orgId/consultas/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const [alvo] = await db
    .delete(consulta)
    .where(and(eq(consulta.id, id), eq(consulta.organizationId, orgId)))
    .returning({ id: consulta.id });
  if (!alvo) return c.json({ error: "Consulta não encontrada." }, 404);

  return c.json({ ok: true });
});
