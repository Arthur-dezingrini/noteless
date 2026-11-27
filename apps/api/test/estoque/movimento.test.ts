import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../../src/db";
import { localEstoque, movimentoEstoque, produto, saldoEstoque } from "../../src/db/tabelas/estoque";
import { estornarMovimento, lancarMovimento, sairPorFefo } from "../../src/modulos/estoque/regras/movimento";
import { podeNoEstoque } from "../../src/modulos/estoque/regras/permissao";
import { criarFazenda } from "../ajuda";

let n = 0;
async function cenario(controlaLote = false) {
  n += 1;
  const f = await criarFazenda(`Livro ${n}`);
  const [p] = await db
    .insert(produto)
    .values({ organizationId: f.orgId, nome: "Ração", categoria: "racao", unidade: "kg", controlaLote })
    .returning();
  const [l] = await db.insert(localEstoque).values({ organizationId: f.orgId, nome: "Depósito", tipo: "deposito" }).returning();
  const base = { orgId: f.orgId, userId: null, produtoId: p!.id, localId: l!.id, data: "2026-11-20" };
  return { f, p: p!, l: l!, base };
}

const entrar = (base: Awaited<ReturnType<typeof cenario>>["base"], quantidade: number, custoUnitario?: number, extra = {}) =>
  db.transaction((tx) => lancarMovimento(tx, { ...base, tipo: "entrada", quantidade, custoUnitario, origemTipo: "manual", ...extra }));

async function saldos(produtoId: string) {
  const rows = await db.select().from(saldoEstoque).where(eq(saldoEstoque.produtoId, produtoId));
  return Object.fromEntries(rows.map((r) => [r.loteFabricacao, Number(r.quantidade)]));
}

const custoMedio = async (id: string) => Number((await db.select().from(produto).where(eq(produto.id, id)))[0]!.custoMedio);

describe("livro de movimentos", () => {
  it("entrada atualiza saldo e custo médio", async () => {
    const { p, base } = await cenario();
    const r = await entrar(base, 100, 2);
    expect(r.saldoLocal).toBe(100);
    await entrar(base, 100, 4);
    expect(await saldos(p.id)).toEqual({ "": 200 });
    expect(await custoMedio(p.id)).toBe(3);
  });

  it("entrada sem custo não mexe no custo médio", async () => {
    const { p, base } = await cenario();
    await entrar(base, 100, 2);
    await entrar(base, 100);
    expect(await custoMedio(p.id)).toBe(2);
  });

  it("saída por FEFO reparte entre lotes e usa o custo médio", async () => {
    const { p, base } = await cenario(true);
    await entrar(base, 10, 5, { loteFabricacao: "A", validade: "2026-12-01" });
    await entrar(base, 5, 5, { loteFabricacao: "B", validade: "2026-11-30" });

    const ids = await db.transaction((tx) => sairPorFefo(tx, { ...base, quantidade: 12, origemTipo: "manual" }));
    const saidas = await db.select().from(movimentoEstoque).where(eq(movimentoEstoque.tipo, "saida"));
    const minhas = saidas.filter((s) => ids.includes(s.id)).map((s) => [s.loteFabricacao, Number(s.quantidade), Number(s.custoUnitario)]);
    expect(minhas.sort()).toEqual([
      ["A", -7, 5],
      ["B", -5, 5],
    ]);
    expect(await saldos(p.id)).toEqual({ A: 3, B: 0 });
  });

  it("falta de saldo deixa negativo no lote vazio, num movimento só", async () => {
    const { p, base } = await cenario();
    await entrar(base, 30, 1);
    const ids = await db.transaction((tx) => sairPorFefo(tx, { ...base, quantidade: 50, origemTipo: "manual" }));
    expect(ids).toHaveLength(1);
    expect(await saldos(p.id)).toEqual({ "": -20 });
  });

  it("dois movimentos ao mesmo tempo somam certo", async () => {
    const { p, base } = await cenario();
    await Promise.all(
      Array.from({ length: 10 }, () => db.transaction((tx) => sairPorFefo(tx, { ...base, quantidade: 1, origemTipo: "manual" }))),
    );
    expect(await saldos(p.id)).toEqual({ "": -10 });
  });

  it("decimais não acumulam resíduo", async () => {
    const { p, base } = await cenario();
    await entrar(base, 480.5, 1);
    await entrar(base, 0.1, 1);
    await entrar(base, 0.2, 1);
    expect(await saldos(p.id)).toEqual({ "": 480.8 });
  });

  it("estorno desfaz e não estorna duas vezes nem estorna estorno", async () => {
    const { f, p, base } = await cenario();
    const { id } = await entrar(base, 10, 1);

    const r = await db.transaction((tx) => estornarMovimento(tx, f.orgId, null, id, "lançado errado"));
    expect(r.ok).toBe(true);
    expect(await saldos(p.id)).toEqual({ "": 0 });

    const deNovo = await db.transaction((tx) => estornarMovimento(tx, f.orgId, null, id, "de novo"));
    expect(deNovo).toEqual({ ok: false, status: 409, erro: "Este movimento já foi estornado." });

    const idEstorno = r.ok ? r.valor[0]! : "";
    const doEstorno = await db.transaction((tx) => estornarMovimento(tx, f.orgId, null, idEstorno, "x"));
    expect(doEstorno).toEqual({ ok: false, status: 409, erro: "Estorno não se estorna." });
  });

  it("estorno de outra organização não acha o movimento", async () => {
    const { base } = await cenario();
    const outra = await criarFazenda("Livro de fora");
    const { id } = await entrar(base, 10, 1);
    const r = await db.transaction((tx) => estornarMovimento(tx, outra.orgId, null, id, "x"));
    expect(r).toEqual({ ok: false, status: 404, erro: "Movimento não encontrado." });
  });

  it("estorno de entrada recalcula o custo médio", async () => {
    const { f, p, base } = await cenario();
    await entrar(base, 100, 2);
    const { id } = await entrar(base, 100, 4);
    expect(await custoMedio(p.id)).toBe(3);
    await db.transaction((tx) => estornarMovimento(tx, f.orgId, null, id, "nota errada"));
    expect(await custoMedio(p.id)).toBe(2);
  });

  it("estornar um lado da transferência estorna os dois", async () => {
    const { f, p, base } = await cenario();
    const [outro] = await db.insert(localEstoque).values({ organizationId: f.orgId, nome: "Silo", tipo: "silo" }).returning();
    await entrar(base, 10, 1);
    const grupoId = crypto.randomUUID();
    const { id } = await db.transaction(async (tx) => {
      const saiu = await lancarMovimento(tx, { ...base, tipo: "transferencia", quantidade: -4, origemTipo: "transferencia", grupoId });
      await lancarMovimento(tx, { ...base, localId: outro!.id, tipo: "transferencia", quantidade: 4, origemTipo: "transferencia", grupoId });
      return saiu;
    });

    const r = await db.transaction((tx) => estornarMovimento(tx, f.orgId, null, id, "errado"));
    expect(r.ok && r.valor).toHaveLength(2);
    const porLocal = await db
      .select()
      .from(saldoEstoque)
      .where(and(eq(saldoEstoque.produtoId, p.id), eq(saldoEstoque.localId, outro!.id)));
    expect(Number(porLocal[0]!.quantidade)).toBe(0);
    const noDeposito = await db
      .select()
      .from(saldoEstoque)
      .where(and(eq(saldoEstoque.produtoId, p.id), eq(saldoEstoque.localId, base.localId)));
    expect(Number(noDeposito[0]!.quantidade)).toBe(10);
  });

  it("podeNoEstoque libera os três papéis", () => {
    for (const papel of ["owner", "admin", "member"] as const) {
      for (const acao of ["lancar", "verCusto", "acertarInventario", "cadastrar"] as const) expect(podeNoEstoque(papel, acao)).toBe(true);
    }
  });
});
