import { criarInstalacaoSchema, editarInstalacaoSchema } from "@vocare/shared";
import { Hono } from "hono";

import { membroAtual } from "../../../base/membro-atual";
import { listarGalpoesHoje, listarInstalacoes } from "../consultas/instalacoes";
import { criarInstalacao, editarInstalacao } from "../regras/instalacoes";
import { PODE_SALVAR, SEM_ACESSO } from "./comum";

/** Galpões (instalações). Qualquer membro lê; cadastrar e editar é do administrador. */
export const galpoesRotas = new Hono();

const SO_ADMIN = "Só o administrador cadastra ou edita instalações.";

galpoesRotas.get("/:orgId/instalacoes", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  return c.json(await listarInstalacoes(orgId));
});

galpoesRotas.get("/:orgId/galpoes-hoje", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  return c.json(await listarGalpoesHoje(orgId));
});

galpoesRotas.post("/:orgId/instalacoes", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN }, 403);

  const body = criarInstalacaoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const r = await criarInstalacao(orgId, eu.userId, body.data);
  return r.ok ? c.json(r.valor, 201) : c.json({ error: r.erro }, r.status);
});

galpoesRotas.patch("/:orgId/instalacoes/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN }, 403);

  const body = editarInstalacaoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const r = await editarInstalacao(orgId, c.req.param("id"), body.data);
  return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);
});
