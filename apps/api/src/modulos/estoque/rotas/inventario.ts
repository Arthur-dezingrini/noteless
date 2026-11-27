import { abrirInventarioSchema, contagemSchema } from "@vocare/shared";
import { Hono, type Context } from "hono";

import type { Resultado } from "../../../base/resultado";
import { listarInventarios, montarInventario } from "../consultas/inventario";
import { abrirInventario, cancelarInventario, contarInventario, fecharInventario } from "../regras/inventario";
import { acesso, corpo } from "./comum";

/** Inventário: abrir a contagem de um local, contar, fechar (gera os ajustes) ou cancelar. */
export const inventarioRotas = new Hono();

async function responder(c: Context, orgId: string, r: Resultado<string>, status: 200 | 201 = 200) {
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(await montarInventario(orgId, r.valor), status);
}

inventarioRotas.get("/:orgId/estoque/inventarios", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  return c.json(await listarInventarios(orgId));
});

inventarioRotas.post("/:orgId/estoque/inventarios", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, abrirInventarioSchema);
  if (b.resposta) return b.resposta;
  return responder(c, orgId, await abrirInventario(orgId, a.eu.userId, b.dados.localId), 201);
});

inventarioRotas.get("/:orgId/estoque/inventarios/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const inv = await montarInventario(orgId, c.req.param("id"));
  return inv ? c.json(inv) : c.json({ error: "Inventário não encontrado." }, 404);
});

inventarioRotas.put("/:orgId/estoque/inventarios/:id/itens", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, contagemSchema);
  if (b.resposta) return b.resposta;
  return responder(c, orgId, await contarInventario(orgId, c.req.param("id"), b.dados));
});

inventarioRotas.post("/:orgId/estoque/inventarios/:id/fechar", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "acertarInventario");
  if (a.resposta) return a.resposta;
  return responder(c, orgId, await fecharInventario(orgId, a.eu.userId, c.req.param("id")));
});

inventarioRotas.post("/:orgId/estoque/inventarios/:id/cancelar", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  return responder(c, orgId, await cancelarInventario(orgId, c.req.param("id")));
});
