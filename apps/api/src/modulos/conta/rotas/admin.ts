import { criarVinculoSchema, mudarPapelSchema, mudarTipoSchema } from "@vocare/shared";
import type { Context } from "hono";
import { Hono } from "hono";

import { quemNaPlataforma } from "../../../base/super-usuario";
import { listarEmpresas, listarUsuariosAdmin } from "../consultas/admin";
import { desvincular, mudarPapel, mudarTipo, vincular } from "../regras/vinculos";

/** Vínculos da plataforma inteira (qualquer usuário em qualquer empresa). Só super usuário. Montado em /api/admin. */
export const adminRoutes = new Hono();

/** 401 sem login, 403 para quem não é super; `null` = pode seguir. */
async function barrar(c: Context) {
  const q = await quemNaPlataforma(c.req.raw.headers);
  if (!q) return c.json({ error: "Faça login." }, 401);
  if (!q.ehSuper) return c.json({ error: "Só o super usuário mexe nos vínculos." }, 403);
  return null;
}

const corpo = async (c: Context) => c.req.json().catch(() => null);
const invalido = (e: { issues: { message: string }[] }) => ({ error: e.issues[0]?.message ?? "Dados inválidos." });

adminRoutes.get("/usuarios", async (c) => {
  const barrado = await barrar(c);
  if (barrado) return barrado;
  return c.json(await listarUsuariosAdmin(c.req.query("busca")));
});

adminRoutes.get("/empresas", async (c) => {
  const barrado = await barrar(c);
  if (barrado) return barrado;
  return c.json(await listarEmpresas());
});

adminRoutes.post("/vinculos", async (c) => {
  const barrado = await barrar(c);
  if (barrado) return barrado;
  const body = criarVinculoSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await vincular(body.data);
  return r.ok ? c.json(r.valor, 201) : c.json({ error: r.erro }, r.status);
});

adminRoutes.patch("/vinculos/:memberId", async (c) => {
  const barrado = await barrar(c);
  if (barrado) return barrado;
  const body = mudarPapelSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await mudarPapel(c.req.param("memberId"), body.data.papel);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});

adminRoutes.delete("/vinculos/:memberId", async (c) => {
  const barrado = await barrar(c);
  if (barrado) return barrado;
  const r = await desvincular(c.req.param("memberId"));
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});

adminRoutes.patch("/usuarios/:userId", async (c) => {
  const barrado = await barrar(c);
  if (barrado) return barrado;
  const body = mudarTipoSchema.safeParse(await corpo(c));
  if (!body.success) return c.json(invalido(body.error), 400);
  const r = await mudarTipo(c.req.param("userId"), body.data.tipo);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.erro }, r.status);
});
