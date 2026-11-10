import type { Novidades } from "@vocare/shared";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { notificacao } from "../db/tabelas/avisos";
import { ocorrencia } from "../db/tabelas/notas";
import { membroAtual } from "../base/membro-atual";

/**
 * A tela aberta pergunta aqui, de poucos em poucos segundos, se precisa
 * buscar os dados de novo. Barato de propósito: só contagens e datas, nada
 * de lista — quem atualiza a tela é o refresh que o front faz depois.
 */
export const novidadesRoutes = new Hono();

novidadesRoutes.get("/:orgId/novidades", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const [[oc], [av]] = await Promise.all([
    // Ocorrências da organização. Chegar muda o total; salvar, descartar e
    // encaminhar carimbam uma data; restaurar muda as pendentes; reescrever
    // o que foi dito muda o tamanho dos textos.
    db
      .select({
        total: sql<number>`count(*)::int`,
        pendentes: sql<number>`(count(*) filter (where ${ocorrencia.status} = 'pendente'))::int`,
        ultima: sql<string | null>`max(greatest(${ocorrencia.createdAt}, ${ocorrencia.revisadoEm}, ${ocorrencia.encaminhadaEm}))::text`,
        letras: sql<number>`coalesce(sum(length(${ocorrencia.transcricao}) + length(${ocorrencia.resumo})), 0)::int`,
      })
      .from(ocorrencia)
      .where(eq(ocorrencia.organizationId, orgId)),
    // Avisos do sino — só os de quem pergunta. Chegar ou ler muda.
    db
      .select({
        total: sql<number>`count(*)::int`,
        naoLidas: sql<number>`(count(*) filter (where ${notificacao.lidaEm} is null))::int`,
        ultima: sql<string | null>`max(${notificacao.createdAt})::text`,
      })
      .from(notificacao)
      .where(and(eq(notificacao.organizationId, orgId), eq(notificacao.userId, eu.userId))),
  ]);

  const partes = [oc?.total, oc?.pendentes, oc?.ultima, oc?.letras, av?.total, av?.naoLidas, av?.ultima];
  const resposta: Novidades = { versao: partes.map((p) => p ?? "").join("|") };
  return c.json(resposta);
});
