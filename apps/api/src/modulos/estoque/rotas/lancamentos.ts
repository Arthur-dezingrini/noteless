import { CATEGORIAS_PRODUTO, entradaManualSchema, estornoInputSchema, ORIGENS_MOVIMENTO, saidaInputSchema, transferenciaInputSchema } from "@vocare/shared";
import { Hono } from "hono";

import { listarEntradas } from "../consultas/entradas";
import { listarMovimentos, movimentosPorIds, type FiltroMovimentos } from "../consultas/movimentos";
import { saldoDaOrg } from "../consultas/saldo";
import { estornarEntrada, lancarEntradaManual } from "../regras/entradas";
import { estornar, lancarSaida, lancarTransferencia } from "../regras/lancamentos";
import { podeNoEstoque } from "../regras/permissao";
import { acesso, corpo } from "./comum";

/** Saldo, livro, entradas, saídas, transferências e estornos. */
export const lancamentosRotas = new Hono();

const DATA = /^\d{4}-\d{2}-\d{2}$/;

lancamentosRotas.get("/:orgId/estoque/saldo", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const categoria = c.req.query("categoria");
  if (categoria && !(CATEGORIAS_PRODUTO as readonly string[]).includes(categoria)) return c.json({ error: "Categoria inválida." }, 400);
  return c.json(await saldoDaOrg(orgId, podeNoEstoque(a.eu.role, "verCusto"), { categoria, localId: c.req.query("localId") }));
});

lancamentosRotas.get("/:orgId/estoque/movimentos", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const q = c.req.query();
  if ((q.de && !DATA.test(q.de)) || (q.ate && !DATA.test(q.ate))) return c.json({ error: "Data inválida." }, 400);
  if (q.origemTipo && !(ORIGENS_MOVIMENTO as readonly string[]).includes(q.origemTipo)) return c.json({ error: "Origem inválida." }, 400);
  const pagina = Math.max(1, Number.parseInt(q.pagina ?? "1", 10) || 1);
  const filtro: FiltroMovimentos = {
    produtoId: q.produtoId,
    localId: q.localId,
    de: q.de,
    ate: q.ate,
    origemTipo: q.origemTipo,
    loteFabricacao: q.loteFabricacao,
    criadoPorId: q.criadoPorId,
  };
  return c.json(await listarMovimentos(orgId, filtro, podeNoEstoque(a.eu.role, "verCusto"), pagina));
});

lancamentosRotas.post("/:orgId/estoque/movimentos/saida", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, saidaInputSchema);
  if (b.resposta) return b.resposta;
  const r = await lancarSaida(orgId, a.eu.userId, b.dados);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  if ("confirmar" in r.valor) return c.json({ error: "Saldo insuficiente.", saldo: r.valor.saldo }, 409);
  return c.json(await movimentosPorIds(orgId, r.valor.ids, podeNoEstoque(a.eu.role, "verCusto")), 201);
});

lancamentosRotas.post("/:orgId/estoque/movimentos/transferencia", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, transferenciaInputSchema);
  if (b.resposta) return b.resposta;
  const r = await lancarTransferencia(orgId, a.eu.userId, b.dados);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(await movimentosPorIds(orgId, r.valor, podeNoEstoque(a.eu.role, "verCusto")), 201);
});

lancamentosRotas.post("/:orgId/estoque/movimentos/:id/estorno", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, estornoInputSchema);
  if (b.resposta) return b.resposta;
  const r = await estornar(orgId, a.eu.userId, c.req.param("id"), b.dados.motivo);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  return c.json(await movimentosPorIds(orgId, r.valor, podeNoEstoque(a.eu.role, "verCusto")));
});

lancamentosRotas.get("/:orgId/estoque/entradas", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  return c.json(await listarEntradas(orgId, podeNoEstoque(a.eu.role, "verCusto")));
});

lancamentosRotas.get("/:orgId/estoque/entradas/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const [e] = await listarEntradas(orgId, podeNoEstoque(a.eu.role, "verCusto"), c.req.param("id"));
  return e ? c.json(e) : c.json({ error: "Entrada não encontrada." }, 404);
});

lancamentosRotas.post("/:orgId/estoque/entradas", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, entradaManualSchema);
  if (b.resposta) return b.resposta;
  const r = await lancarEntradaManual(orgId, a.eu.userId, b.dados);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [e] = await listarEntradas(orgId, podeNoEstoque(a.eu.role, "verCusto"), r.valor);
  return c.json(e, 201);
});

lancamentosRotas.post("/:orgId/estoque/entradas/:id/estorno", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, estornoInputSchema);
  if (b.resposta) return b.resposta;
  const r = await estornarEntrada(orgId, a.eu.userId, c.req.param("id"), b.dados.motivo);
  if (!r.ok) return c.json({ error: r.erro }, r.status);
  const [e] = await listarEntradas(orgId, podeNoEstoque(a.eu.role, "verCusto"), r.valor);
  return c.json(e);
});
