import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../../src/db";
import { instalacao } from "../../src/db/tabelas/aviario";
import { localEstoque, movimentoEstoque, produto, saldoEstoque } from "../../src/db/tabelas/estoque";
import { baixarInsumo, sincronizarRacao } from "../../src/modulos/estoque/regras/baixas";
import { lancarMovimento } from "../../src/modulos/estoque/regras/movimento";
import { criarFazenda } from "../ajuda";

let n = 0;
async function granja({ comSilo = true, comRacao = true } = {}) {
  n += 1;
  const f = await criarFazenda(`Baixas ${n}`);
  const [galpao] = await db.insert(instalacao).values({ organizationId: f.orgId, nome: "Galpão 1", tipo: "galpao" }).returning();
  const [racao] = await db.insert(produto).values({ organizationId: f.orgId, nome: "Ração", categoria: "racao", unidade: "kg" }).returning();
  const [silo] = comSilo
    ? await db.insert(localEstoque).values({ organizationId: f.orgId, nome: "Silo 1", tipo: "silo", instalacaoId: galpao!.id }).returning()
    : [undefined];
  if (silo && comRacao) {
    await db.transaction((tx) =>
      lancarMovimento(tx, { orgId: f.orgId, userId: null, produtoId: racao!.id, localId: silo.id, tipo: "entrada", quantidade: 1000, custoUnitario: 2, data: "2026-11-01", origemTipo: "manual" }),
    );
  }
  const sincronizar = (racaoKg: number | null, apontamentoId = "ap1") =>
    db.transaction((tx) => sincronizarRacao(tx, { orgId: f.orgId, userId: null, instalacaoId: galpao!.id, apontamentoId, data: "2026-11-20", racaoKg }));
  const saldo = async () => {
    if (!silo) return null;
    const rows = await db.select().from(saldoEstoque).where(and(eq(saldoEstoque.localId, silo.id), eq(saldoEstoque.produtoId, racao!.id)));
    return rows.reduce((t, r) => t + Number(r.quantidade), 0);
  };
  const doApontamento = (apontamentoId = "ap1") =>
    db
      .select()
      .from(movimentoEstoque)
      .where(
        and(
          eq(movimentoEstoque.organizationId, f.orgId),
          eq(movimentoEstoque.origemTipo, "apontamento_aviario"),
          eq(movimentoEstoque.origemId, apontamentoId),
        ),
      );
  return { f, galpao: galpao!, racao: racao!, silo, sincronizar, saldo, doApontamento };
}

describe("baixa da ração pelo registro diário", () => {
  it("a ração sai do silo ligado ao galpão", async () => {
    const g = await granja();
    const r = await g.sincronizar(200);
    expect(r).toEqual({ semSilo: false, mexeu: [{ produtoId: g.racao.id, localId: g.silo!.id }] });
    expect(await g.saldo()).toBe(800);
    const [m] = await g.doApontamento();
    expect(m).toMatchObject({ tipo: "saida", quantidade: "-200.000", custoUnitario: "2.0000", data: "2026-11-20" });
  });

  it("a mesma quantidade não gera movimento novo", async () => {
    const g = await granja();
    await g.sincronizar(200);
    const r = await g.sincronizar(200);
    expect(r.mexeu).toEqual([]);
    expect(await g.doApontamento()).toHaveLength(1);
  });

  it("quantidade nova estorna a anterior e lança a nova; zerar só estorna", async () => {
    const g = await granja();
    await g.sincronizar(200);
    await g.sincronizar(250);
    expect(await g.saldo()).toBe(750);
    expect((await g.doApontamento()).map((m) => m.tipo).sort()).toEqual(["estorno", "saida", "saida"]);

    await g.sincronizar(null);
    expect(await g.saldo()).toBe(1000);
  });

  it("organização sem nenhum silo não usa o estoque para a ração: não baixa nem avisa", async () => {
    const g = await granja({ comSilo: false });
    expect(await g.sincronizar(200)).toEqual({ semSilo: false, mexeu: [] });
    expect(await g.doApontamento()).toHaveLength(0);
  });

  it("galpão sem silo, numa organização que tem silo em outro galpão, não baixa e avisa pelo retorno", async () => {
    const g = await granja({ comSilo: false });
    const [outro] = await db.insert(instalacao).values({ organizationId: g.f.orgId, nome: "Galpão 9", tipo: "galpao" }).returning();
    await db.insert(localEstoque).values({ organizationId: g.f.orgId, nome: "Silo 9", tipo: "silo", instalacaoId: outro!.id });
    expect(await g.sincronizar(200)).toEqual({ semSilo: true, mexeu: [] });
    expect(await g.doApontamento()).toHaveLength(0);
  });

  it("silo que nunca recebeu ração não baixa", async () => {
    const g = await granja({ comRacao: false });
    expect(await g.sincronizar(200)).toEqual({ semSilo: true, mexeu: [] });
  });

  it("acabou a ração no silo: a sobra sai da última que entrou e fica negativa", async () => {
    const g = await granja();
    await g.sincronizar(1200);
    expect(await g.saldo()).toBe(-200);
  });
});

describe("baixa de insumo (vacinação, tratamento)", () => {
  async function farmacia() {
    n += 1;
    const f = await criarFazenda(`Insumo ${n}`);
    const [vacina] = await db
      .insert(produto)
      .values({ organizationId: f.orgId, nome: "Newcastle", categoria: "vacina", unidade: "dose", controlaLote: true })
      .returning();
    const [racao] = await db.insert(produto).values({ organizationId: f.orgId, nome: "Ração", categoria: "racao", unidade: "kg" }).returning();
    const [geladeira] = await db.insert(localEstoque).values({ organizationId: f.orgId, nome: "Geladeira", tipo: "geladeira" }).returning();
    const [outra] = await db.insert(localEstoque).values({ organizationId: f.orgId, nome: "Geladeira 2", tipo: "geladeira" }).returning();
    const entrar = (localId: string, lote: string) =>
      db.transaction((tx) =>
        lancarMovimento(tx, { orgId: f.orgId, userId: null, produtoId: vacina!.id, localId, tipo: "entrada", quantidade: 1000, loteFabricacao: lote, validade: "2027-01-01", data: "2026-11-01", origemTipo: "manual" }),
      );
    const baixar = (dados: { produtoId?: string; localId?: string; quantidade?: number }) =>
      db.transaction((tx) =>
        baixarInsumo(tx, {
          orgId: f.orgId,
          userId: null,
          origemTipo: "vacinacao_lote",
          origemId: "vac1",
          data: "2026-11-20",
          produtoId: dados.produtoId ?? vacina!.id,
          localId: dados.localId,
          quantidade: dados.quantidade ?? 300,
          categorias: ["vacina", "medicamento"],
        }),
      );
    return { f, vacina: vacina!, racao: racao!, geladeira: geladeira!, outra: outra!, entrar, baixar };
  }

  it("sai do único local que tem saldo, por FEFO", async () => {
    const x = await farmacia();
    await x.entrar(x.geladeira.id, "L1");
    const r = await x.baixar({});
    expect(r).toEqual({ ok: true, valor: { produtoId: x.vacina.id, localId: x.geladeira.id } });
    const [s] = await db.select().from(saldoEstoque).where(eq(saldoEstoque.localId, x.geladeira.id));
    expect(Number(s!.quantidade)).toBe(700);
  });

  it("produto de categoria errada 400", async () => {
    const x = await farmacia();
    expect(await x.baixar({ produtoId: x.racao.id, localId: x.geladeira.id })).toEqual({
      ok: false,
      status: 400,
      erro: "Este produto não é vacina ou medicamento.",
    });
  });

  it("dois locais com saldo e nenhum escolhido 422; escolhido, sai dele", async () => {
    const x = await farmacia();
    await x.entrar(x.geladeira.id, "L1");
    await x.entrar(x.outra.id, "L2");
    expect(await x.baixar({})).toEqual({ ok: false, status: 422, erro: "Escolha o local do estoque." });
    expect((await x.baixar({ localId: x.outra.id })).ok).toBe(true);
  });

  it("produto de outra organização 404", async () => {
    const x = await farmacia();
    const fora = await farmacia();
    expect(await x.baixar({ produtoId: fora.vacina.id, localId: x.geladeira.id })).toEqual({ ok: false, status: 404, erro: "Produto não encontrado." });
  });
});
