import { confirmarNfeSchema, lerNfeSchema } from "@vocare/shared";
import { Hono } from "hono";

import { listarEntradas } from "../consultas/entradas";
import { confirmarNfe, lerParaConferir } from "../regras/nfe";
import { podeNoEstoque } from "../regras/permissao";
import { acesso, corpo } from "./comum";

/** Importar NF-e pelo XML: ler (conferência, sem gravar) e confirmar (grava a entrada). */
export const nfeRotas = new Hono();

nfeRotas.post("/:orgId/estoque/nfe/ler", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, lerNfeSchema);
  if (b.resposta) return b.resposta;
  const r = await lerParaConferir(orgId, b.dados.xml);
  return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);
});

nfeRotas.post("/:orgId/estoque/nfe/confirmar", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, confirmarNfeSchema);
  if (b.resposta) return b.resposta;
  const r = await confirmarNfe(orgId, a.eu.userId, b.dados);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [e] = await listarEntradas(orgId, podeNoEstoque(a.eu.role, "verCusto"), r.valor);
  return c.json(e, 201);
});
