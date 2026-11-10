import { pesagemLoteInputSchema, vacinacaoLoteInputSchema, valoresApontamentoSchema } from "@vocare/shared";
import { Hono } from "hono";

import { membroAtual } from "../../../base/membro-atual";
import { montarFicha } from "../consultas/ficha";
import { lancarApontamento, lancarPesagem, lancarVacinacao } from "../regras/registros";
import { dataReal, PODE_SALVAR, SEM_ACESSO } from "./comum";

/** Lançamentos do lote: apontamento diário por galpão, pesagem e vacinação. Devolvem a ficha. */
export const registrosRotas = new Hono();

const SO_ADMIN_LANCA = "Só o administrador lança apontamentos, pesagens e vacinações.";

registrosRotas.put("/:orgId/lotes/:id/apontamentos/:instalacaoId/:data", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const data = c.req.param("data");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LANCA }, 403);

  if (!dataReal(data)) return c.json({ error: "Data inválida." }, 400);
  const body = valoresApontamentoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const r = await lancarApontamento(orgId, eu.userId, id, c.req.param("instalacaoId"), data, body.data);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(await montarFicha(orgId, id));
});

registrosRotas.post("/:orgId/lotes/:id/pesagens", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LANCA }, 403);

  const body = pesagemLoteInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  if (!dataReal(body.data.data)) return c.json({ error: "Data inválida." }, 400);

  const r = await lancarPesagem(orgId, eu.userId, id, body.data);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(await montarFicha(orgId, id), 201);
});

registrosRotas.post("/:orgId/lotes/:id/vacinacoes", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LANCA }, 403);

  const body = vacinacaoLoteInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  if (!dataReal(body.data.data) || (body.data.proximaData && !dataReal(body.data.proximaData))) {
    return c.json({ error: "Data inválida." }, 400);
  }

  const r = await lancarVacinacao(orgId, eu.userId, id, body.data);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(await montarFicha(orgId, id), 201);
});
