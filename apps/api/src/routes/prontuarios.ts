import {
  atualizarProntuarioSchema,
  criarProntuarioSchema,
  especieSchema,
  examePedidoSchema,
  medidaSchema,
  remedioReceitadoSchema,
  sexoSchema,
  tipoConsultaSchema,
  type Prontuario,
} from "@vocare/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db";
import { animal } from "../db/animais";
import { consulta, prontuario } from "../db/consultas";
import { member, user } from "../db/schema";
import { membroAtual } from "../membros/membro-atual";

/**
 * Prontuários: o registro de cada atendimento. Qualquer membro registra e
 * corrige (é o veterinário quem atende); apagar é só do administrador, porque
 * prontuário é documento.
 */
export const prontuariosRoutes = new Hono();

const retorno = alias(consulta, "retorno");

const colunas = {
  id: prontuario.id,
  animalId: prontuario.animalId,
  animalNome: animal.nome,
  animalNumero: animal.numero,
  animalEspecie: animal.especie,
  animalRaca: animal.raca,
  animalSexo: animal.sexo,
  animalNascimento: animal.nascimento,
  consultaId: prontuario.consultaId,
  veterinarioId: prontuario.veterinarioId,
  veterinarioNome: user.name,
  data: prontuario.data,
  tipo: prontuario.tipo,
  queixa: prontuario.queixa,
  exame: prontuario.exame,
  diagnostico: prontuario.diagnostico,
  remedios: prontuario.remedios,
  exames: prontuario.exames,
  retornoId: retorno.id,
  retornoData: retorno.data,
  retornoHora: retorno.hora,
  createdAt: prontuario.createdAt,
};

type Linha = { [K in keyof typeof colunas]: (typeof colunas)[K]["_"]["data"] | null };

/** JSON do banco → lista validada; item estragado some em vez de derrubar a tela. */
function lista<T extends z.ZodType>(schema: T, v: unknown): z.infer<T>[] {
  return z
    .array(z.unknown())
    .catch([])
    .parse(v)
    .flatMap((x) => {
      const r = schema.safeParse(x);
      return r.success ? [r.data] : [];
    });
}

function paraContrato(r: Linha): Prontuario {
  return {
    id: r.id!,
    animalId: r.animalId!,
    animalNome: r.animalNome ?? "",
    animalNumero: r.animalNumero,
    animalEspecie: especieSchema.catch("outro").parse(r.animalEspecie),
    animalRaca: r.animalRaca,
    animalSexo: sexoSchema.nullish().catch(null).parse(r.animalSexo),
    animalNascimento: r.animalNascimento,
    consultaId: r.consultaId,
    veterinarioId: r.veterinarioId,
    veterinarioNome: r.veterinarioNome,
    data: r.data!,
    tipo: tipoConsultaSchema.catch("outro").parse(r.tipo),
    queixa: r.queixa ?? "",
    exame: lista(medidaSchema, r.exame),
    diagnostico: r.diagnostico ?? "",
    remedios: lista(remedioReceitadoSchema, r.remedios),
    exames: lista(examePedidoSchema, r.exames),
    retorno: r.retornoId ? { id: r.retornoId, data: r.retornoData!, hora: r.retornoHora! } : null,
    createdAt: r.createdAt!,
  };
}

function consultar() {
  return db
    .select(colunas)
    .from(prontuario)
    .innerJoin(animal, eq(animal.id, prontuario.animalId))
    .leftJoin(user, eq(user.id, prontuario.veterinarioId))
    .leftJoin(retorno, eq(retorno.id, prontuario.retornoId));
}

/**
 * Animal, veterinário e consulta precisam ser desta organização — e a
 * consulta, do mesmo animal. Sem isso um id chutado ligaria o atendimento
 * à fazenda de outro.
 */
async function validarVinculos(
  orgId: string,
  d: { animalId: string; veterinarioId?: string | null; consultaId?: string | null },
  ignorar?: string,
) {
  const [a] = await db
    .select({ id: animal.id })
    .from(animal)
    .where(and(eq(animal.id, d.animalId), eq(animal.organizationId, orgId)))
    .limit(1);
  if (!a) return "Animal não encontrado nesta organização.";

  if (d.veterinarioId) {
    const [m] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, d.veterinarioId), eq(member.organizationId, orgId)))
      .limit(1);
    if (!m) return "Veterinário não faz parte desta organização.";
  }

  if (d.consultaId) {
    const [cons] = await db
      .select({ animalId: consulta.animalId })
      .from(consulta)
      .where(and(eq(consulta.id, d.consultaId), eq(consulta.organizationId, orgId)))
      .limit(1);
    if (!cons) return "Consulta não encontrada.";
    if (cons.animalId !== d.animalId) return "Essa consulta é de outro animal.";
    const [ja] = await db
      .select({ id: prontuario.id })
      .from(prontuario)
      .where(eq(prontuario.consultaId, d.consultaId))
      .limit(1);
    if (ja && ja.id !== ignorar) return "Essa consulta já tem atendimento registrado.";
  }
  return null;
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

prontuariosRoutes.get("/:orgId/prontuarios", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const filtros = [eq(prontuario.organizationId, orgId)];
  const animalId = c.req.query("animal");
  if (animalId) filtros.push(eq(prontuario.animalId, animalId));

  const rows = await consultar()
    .where(and(...filtros))
    .orderBy(desc(prontuario.data), desc(prontuario.createdAt));
  return c.json(rows.map(paraContrato));
});

prontuariosRoutes.post("/:orgId/prontuarios", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = criarProntuarioSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  const d = body.data;

  const erro = await validarVinculos(orgId, d);
  if (erro) return c.json({ error: erro }, 400);

  const id = await db.transaction(async (tx) => {
    let retornoId: string | null = null;
    if (d.retorno) {
      const [r] = await tx
        .insert(consulta)
        .values({
          organizationId: orgId,
          animalId: d.animalId,
          veterinarioId: d.veterinarioId ?? null,
          data: d.retorno.data,
          hora: d.retorno.hora,
          tipo: "retorno",
          observacoes: `Retorno do atendimento de ${dm(d.data)}.`,
        })
        .returning({ id: consulta.id });
      retornoId = r!.id;
    }

    // Registrar o atendimento é dizer que a consulta aconteceu.
    if (d.consultaId) {
      await tx
        .update(consulta)
        .set({ status: "concluida" })
        .where(and(eq(consulta.id, d.consultaId), inArray(consulta.status, ["agendada", "confirmada", "urgente"])));
    }

    const [novo] = await tx
      .insert(prontuario)
      .values({
        organizationId: orgId,
        animalId: d.animalId,
        consultaId: d.consultaId ?? null,
        veterinarioId: d.veterinarioId ?? null,
        data: d.data,
        tipo: d.tipo,
        queixa: d.queixa,
        exame: d.exame,
        diagnostico: d.diagnostico,
        remedios: d.remedios,
        exames: d.exames,
        retornoId,
        criadoPorId: eu.userId,
      })
      .returning({ id: prontuario.id });
    return novo!.id;
  });

  return c.json({ id }, 201);
});

prontuariosRoutes.patch("/:orgId/prontuarios/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = atualizarProntuarioSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  const d = body.data;

  const [atual] = await db
    .select({ retornoId: prontuario.retornoId, retornoStatus: retorno.status })
    .from(prontuario)
    .leftJoin(retorno, eq(retorno.id, prontuario.retornoId))
    .where(and(eq(prontuario.id, id), eq(prontuario.organizationId, orgId)))
    .limit(1);
  if (!atual) return c.json({ error: "Atendimento não encontrado." }, 404);

  const erro = await validarVinculos(orgId, d, id);
  if (erro) return c.json({ error: erro }, 400);

  await db.transaction(async (tx) => {
    let retornoId = atual.retornoId;
    if (d.retorno && retornoId) {
      await tx.update(consulta).set({ data: d.retorno.data, hora: d.retorno.hora }).where(eq(consulta.id, retornoId));
    } else if (d.retorno) {
      const [r] = await tx
        .insert(consulta)
        .values({
          organizationId: orgId,
          animalId: d.animalId,
          veterinarioId: d.veterinarioId ?? null,
          data: d.retorno.data,
          hora: d.retorno.hora,
          tipo: "retorno",
          observacoes: `Retorno do atendimento de ${dm(d.data)}.`,
        })
        .returning({ id: consulta.id });
      retornoId = r!.id;
    } else if (retornoId) {
      // Tirou o retorno: sai da agenda, a não ser que já tenha acontecido.
      if (atual.retornoStatus !== "concluida") await tx.delete(consulta).where(eq(consulta.id, retornoId));
      retornoId = null;
    }

    await tx
      .update(prontuario)
      .set({
        animalId: d.animalId,
        consultaId: d.consultaId ?? null,
        veterinarioId: d.veterinarioId ?? null,
        data: d.data,
        tipo: d.tipo,
        queixa: d.queixa,
        exame: d.exame,
        diagnostico: d.diagnostico,
        remedios: d.remedios,
        exames: d.exames,
        retornoId,
      })
      .where(eq(prontuario.id, id));
  });

  return c.json({ ok: true });
});

prontuariosRoutes.delete("/:orgId/prontuarios/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);
  if (eu.role === "member") return c.json({ error: "Só o administrador apaga um atendimento." }, 403);

  const [alvo] = await db
    .delete(prontuario)
    .where(and(eq(prontuario.id, id), eq(prontuario.organizationId, orgId)))
    .returning({ id: prontuario.id });
  if (!alvo) return c.json({ error: "Atendimento não encontrado." }, 404);

  return c.json({ ok: true });
});
