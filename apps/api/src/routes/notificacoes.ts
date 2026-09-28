import type { Notificacao } from "@vocare/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { notificacao } from "../db/historico";
import { membroAtual } from "../membros/membro-atual";

/** O sino: os avisos do usuário atual nesta organização. */
export const notificacoesRoutes = new Hono();

notificacoesRoutes.get("/:orgId/notificacoes", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const rows = await db
    .select()
    .from(notificacao)
    .where(and(eq(notificacao.organizationId, orgId), eq(notificacao.userId, eu.userId)))
    .orderBy(desc(notificacao.createdAt))
    .limit(30);

  const lista: Notificacao[] = rows.map((n) => ({
    id: n.id,
    texto: n.texto,
    detalhe: n.detalhe,
    link: n.link,
    lida: n.lidaEm !== null,
    createdAt: n.createdAt,
  }));
  return c.json(lista);
});

/** Marca uma como lida (ao abrir o aviso). */
notificacoesRoutes.post("/:orgId/notificacoes/:id/lida", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  await db
    .update(notificacao)
    .set({ lidaEm: new Date() })
    .where(and(eq(notificacao.id, c.req.param("id")), eq(notificacao.userId, eu.userId), isNull(notificacao.lidaEm)));
  return c.json({ ok: true });
});

/** "Marcar todas como lidas". */
notificacoesRoutes.post("/:orgId/notificacoes/lidas", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  await db
    .update(notificacao)
    .set({ lidaEm: new Date() })
    .where(and(eq(notificacao.organizationId, orgId), eq(notificacao.userId, eu.userId), isNull(notificacao.lidaEm)));
  return c.json({ ok: true });
});
