import { timingSafeEqual } from "node:crypto";

import { Hono } from "hono";

import { env } from "../../env";
import { conferirAvisosEstoque } from "../estoque";
import { apagarAudiosVencidos } from "./regras/limpeza-audio";

/**
 * Rotinas que a rotina diária do GitHub Actions chama, com o segredo no
 * cabeçalho em vez de sessão. Montado em /api/rotinas.
 */
export const rotinasRoutes = new Hono();

function segredoConfere(cabecalho: string | undefined, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho ?? "");
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

rotinasRoutes.post("/limpeza-audio", async (c) => {
  const segredo = env.ROTINAS_SEGREDO;
  if (!segredo) return c.json({ error: "Rotina não configurada." }, 503);
  if (!segredoConfere(c.req.header("Authorization"), segredo)) return c.json({ error: "Não autorizado." }, 401);
  return c.json({ apagados: await apagarAudiosVencidos(new Date()) });
});

/** Avisos do estoque (mínimo, ração acabando, validade, saldo negativo, ração sem baixa), uma vez por dia. */
rotinasRoutes.post("/estoque-avisos", async (c) => {
  const segredo = env.ROTINAS_SEGREDO;
  if (!segredo) return c.json({ error: "Rotina não configurada." }, 503);
  if (!segredoConfere(c.req.header("Authorization"), segredo)) return c.json({ error: "Não autorizado." }, 401);
  return c.json(await conferirAvisosEstoque(new Date()));
});
