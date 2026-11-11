import { estadoGravadorSchema, mudarGravadorSchema } from "@vocare/shared";
import type { Context } from "hono";
import { Hono } from "hono";

import { membroAtual } from "../../../base/membro-atual";
import { quemNaPlataforma } from "../../../base/super-usuario";
import { listarGravadores } from "../consultas/gravadores";
import { esquecerGravador, mudarGravador, receberEstado } from "../regras/gravadores";

const corpo = async (c: Context) => c.req.json().catch(() => null);
const invalido = (e: { issues: { message: string }[] }) => ({ error: e.issues[0]?.message ?? "Dados inválidos." });

/** A placa avisando o estado, com a sessão da conta dela. Montado em /api/gravadores. */
export const gravadoresRoutes = new Hono();

gravadoresRoutes.post("/estado", async (c) => {
  const q = await quemNaPlataforma(c.req.raw.headers);
  if (!q) return c.json({ error: "Faça login." }, 401);
  const body = estadoGravadorSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await receberEstado(q.userId, body.data);
  return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);
});

/** Os gravadores que mandam notas para a empresa: administrador vê, sem mexer. Montado em /api/org. */
export const gravadoresOrgRoutes = new Hono();

gravadoresOrgRoutes.get("/:orgId/gravadores", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);
  if (eu.role === "member") return c.json({ error: "Só administradores veem os gravadores." }, 403);
  return c.json(await listarGravadores(orgId));
});

/** Todos os gravadores: ver, renomear, escolher a empresa e esquecer. Só super usuário. Montado em /api/admin/gravadores. */
export const gravadoresAdminRoutes = new Hono();

gravadoresAdminRoutes.use(async (c, next) => {
  const q = await quemNaPlataforma(c.req.raw.headers);
  if (!q) return c.json({ error: "Faça login." }, 401);
  if (!q.ehSuper) return c.json({ error: "Só o super usuário mexe nos gravadores." }, 403);
  await next();
});

gravadoresAdminRoutes.get("/", async (c) => c.json(await listarGravadores()));

gravadoresAdminRoutes.patch("/:id", async (c) => {
  const body = mudarGravadorSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await mudarGravador(c.req.param("id"), body.data);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});

gravadoresAdminRoutes.delete("/:id", async (c) => {
  const r = await esquecerGravador(c.req.param("id"));
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});
