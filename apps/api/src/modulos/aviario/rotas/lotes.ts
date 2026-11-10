import { criarLoteSchema, encerrarLoteSchema, faseLoteSchema, transferirLoteSchema } from "@vocare/shared";
import { Hono } from "hono";

import { membroAtual } from "../../../base/membro-atual";
import { montarFicha } from "../consultas/ficha";
import { listarLotes } from "../consultas/resumo";
import { criarLote, desfazerTransferencia, encerrarLote, mudarFase, reabrirLote, transferirLote } from "../regras/lotes";
import { PODE_SALVAR, SEM_ACESSO } from "./comum";

/** Lotes: lista, ficha e o ciclo de vida (alojar, transferir, mudar fase, encerrar, desfazer). */
export const lotesRotas = new Hono();

const SO_ADMIN_LOTE = "Só o administrador cria ou altera lotes.";

lotesRotas.get("/:orgId/lotes", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  const situacao = c.req.query("situacao");
  if (situacao !== undefined && situacao !== "ativo" && situacao !== "encerrado") {
    return c.json({ error: "Situação inválida. Use ativo ou encerrado." }, 400);
  }
  return c.json(await listarLotes(orgId, { situacao }));
});

lotesRotas.post("/:orgId/lotes", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = criarLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const r = await criarLote(orgId, eu.userId, body.data);
  return r.ok ? c.json(r.valor, 201) : c.json({ error: r.erro }, r.status);
});

lotesRotas.post("/:orgId/lotes/:id/transferir", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = transferirLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const r = await transferirLote(orgId, eu.userId, id, body.data);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

lotesRotas.post("/:orgId/lotes/:id/fase", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = faseLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const r = await mudarFase(orgId, id, body.data.fase);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

lotesRotas.post("/:orgId/lotes/:id/encerrar", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = encerrarLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const r = await encerrarLote(orgId, id, body.data.data);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

lotesRotas.post("/:orgId/lotes/:id/desfazer-transferencia", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const r = await desfazerTransferencia(orgId, id);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

lotesRotas.post("/:orgId/lotes/:id/reabrir", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const r = await reabrirLote(orgId, id);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

lotesRotas.get("/:orgId/lotes/:id", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  const ficha = await montarFicha(orgId, c.req.param("id"));
  if (!ficha) return c.json({ error: "Lote não encontrado." }, 404);
  return c.json(ficha);
});
