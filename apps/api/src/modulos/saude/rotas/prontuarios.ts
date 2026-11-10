import { atualizarProntuarioSchema, criarProntuarioSchema } from "@vocare/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../../../db";
import { animal } from "../../../db/tabelas/animais";
import { consulta, prontuario } from "../../../db/tabelas/saude";
import { member } from "../../../db/schema";
import { membroAtual } from "../../../base/membro-atual";
import { consultar, paraContrato, retorno } from "../consultas/prontuarios";
import { validarVinculos } from "../regras/prontuarios";

/**
 * Prontuários: o registro de cada atendimento. Qualquer membro registra e
 * corrige (é o veterinário quem atende); apagar é só do administrador, porque
 * prontuário é documento.
 */
export const prontuariosRoutes = new Hono();

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
