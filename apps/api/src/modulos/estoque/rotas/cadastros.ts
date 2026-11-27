import {
  criarFornecedorSchema,
  criarLocalSchema,
  criarProdutoSchema,
  editarFornecedorSchema,
  editarLocalSchema,
  editarProdutoSchema,
} from "@vocare/shared";
import { Hono } from "hono";

import { listarFornecedores, listarLocais, listarProdutos } from "../consultas/cadastros";
import { criarFornecedor, criarLocal, criarProduto, editarFornecedor, editarLocal, editarProduto } from "../regras/cadastros";
import { podeNoEstoque } from "../regras/permissao";
import { acesso, corpo } from "./comum";

/** Produtos, locais e fornecedores do estoque. Qualquer membro lê; cadastrar segue `podeNoEstoque`. */
export const cadastrosRotas = new Hono();

cadastrosRotas.get("/:orgId/estoque/produtos", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  return c.json(await listarProdutos(orgId, podeNoEstoque(a.eu.role, "verCusto")));
});

cadastrosRotas.post("/:orgId/estoque/produtos", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "cadastrar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, criarProdutoSchema);
  if (b.resposta) return b.resposta;
  const r = await criarProduto(orgId, a.eu.userId, b.dados, podeNoEstoque(a.eu.role, "verCusto"));
  return r.ok ? c.json(r.valor, 201) : c.json({ error: r.erro }, r.status);
});

cadastrosRotas.patch("/:orgId/estoque/produtos/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "cadastrar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, editarProdutoSchema);
  if (b.resposta) return b.resposta;
  const r = await editarProduto(orgId, c.req.param("id"), b.dados, podeNoEstoque(a.eu.role, "verCusto"));
  return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);
});

cadastrosRotas.get("/:orgId/estoque/locais", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  return c.json(await listarLocais(orgId));
});

cadastrosRotas.post("/:orgId/estoque/locais", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "cadastrar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, criarLocalSchema);
  if (b.resposta) return b.resposta;
  const r = await criarLocal(orgId, a.eu.userId, b.dados);
  return r.ok ? c.json(r.valor, 201) : c.json({ error: r.erro }, r.status);
});

cadastrosRotas.patch("/:orgId/estoque/locais/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "cadastrar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, editarLocalSchema);
  if (b.resposta) return b.resposta;
  const r = await editarLocal(orgId, c.req.param("id"), b.dados);
  return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);
});

cadastrosRotas.get("/:orgId/estoque/fornecedores", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "lancar");
  if (a.resposta) return a.resposta;
  return c.json(await listarFornecedores(orgId));
});

cadastrosRotas.post("/:orgId/estoque/fornecedores", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "cadastrar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, criarFornecedorSchema);
  if (b.resposta) return b.resposta;
  const r = await criarFornecedor(orgId, a.eu.userId, b.dados);
  return r.ok ? c.json(r.valor, 201) : c.json({ error: r.erro }, r.status);
});

cadastrosRotas.patch("/:orgId/estoque/fornecedores/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const a = await acesso(c, orgId, "cadastrar");
  if (a.resposta) return a.resposta;
  const b = await corpo(c, editarFornecedorSchema);
  if (b.resposta) return b.resposta;
  const r = await editarFornecedor(orgId, c.req.param("id"), b.dados);
  return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);
});
