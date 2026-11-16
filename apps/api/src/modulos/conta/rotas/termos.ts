import { VERSAO_TERMOS } from "@vocare/shared";
import { Hono } from "hono";

import { auth } from "../../../auth";
import { aceitarTermos, aceiteDaVersao } from "../regras/termos";

/** Aceite dos Termos de Uso e da Política de Privacidade pela própria pessoa. Montado em /api/perfil/termos. */
export const termosRoutes = new Hono();

/** O primeiro IP de x-forwarded-for é o de quem chamou; os seguintes são proxies. */
function ipDaRequisicao(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

termosRoutes.get("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Não autenticado." }, 401);
  return c.json({ versao: VERSAO_TERMOS, aceitoEm: await aceiteDaVersao(session.user.id, VERSAO_TERMOS) });
});

termosRoutes.post("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Não autenticado." }, 401);
  const corpo = await c.req.json().catch(() => null);
  const r = await aceitarTermos(session.user.id, corpo, ipDaRequisicao(c.req.raw.headers));
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(r.valor);
});
