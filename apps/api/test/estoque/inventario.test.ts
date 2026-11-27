import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { hojeISO } from "../../src/base/datas";
import { db } from "../../src/db";
import { movimentoEstoque } from "../../src/db/tabelas/estoque";
import { chamar, criarFazenda } from "../ajuda";

const HOJE = hojeISO();
let n = 0;

/** Depósito com ração (100 kg, sem lote) e vacina em dois lotes (L1: 50, L2: 30). */
async function deposito() {
  n += 1;
  const f = await criarFazenda(`Inventario ${n}`);
  const base = `/api/org/${f.orgId}/estoque`;
  const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${base}/${caminho}`, corpo)).json;
  const racao = await post("produtos", { nome: "Ração", categoria: "racao", unidade: "kg" });
  const vacina = await post("produtos", { nome: "Newcastle", categoria: "vacina", unidade: "dose" });
  const desinfetante = await post("produtos", { nome: "Desinfetante", categoria: "material", unidade: "l" });
  const local = await post("locais", { nome: "Depósito", tipo: "deposito" });
  const outro = await post("locais", { nome: "Geladeira", tipo: "geladeira" });
  await post("entradas", {
    data: HOJE,
    itens: [
      { produtoId: racao.id, localId: local.id, quantidade: 100, custoTotal: 200 },
      { produtoId: vacina.id, localId: local.id, quantidade: 50, loteFabricacao: "L1", validade: "2027-01-31" },
      { produtoId: vacina.id, localId: local.id, quantidade: 30, loteFabricacao: "L2", validade: "2027-03-31" },
    ],
  });
  const saldoDe = async (produtoId: string) => {
    const r = await chamar(f.dono, "GET", `${base}/saldo?localId=${local.id}`);
    return r.json.find((s: { produto: { id: string } }) => s.produto.id === produtoId);
  };
  return { f, base, racao, vacina, desinfetante, local, outro, saldoDe };
}

describe("inventário do estoque", () => {
  it("abrir, contar e fechar gera ajustes só das diferenças", async () => {
    const d = await deposito();
    const aberto = await chamar(d.f.membro, "POST", `${d.base}/inventarios`, { localId: d.local.id });
    expect(aberto.status).toBe(201);
    expect(aberto.json).toMatchObject({ localNome: "Depósito", status: "aberto", fechadoEm: null });
    // Mostra o que o sistema tem no local, para contar.
    expect(aberto.json.itens.map((i: { produtoNome: string; loteFabricacao: string; saldoAtual: number }) => [i.produtoNome, i.loteFabricacao, i.saldoAtual]).sort()).toEqual([
      ["Newcastle", "L1", 50],
      ["Newcastle", "L2", 30],
      ["Ração", "", 100],
    ]);

    const contar = await chamar(d.f.membro, "PUT", `${d.base}/inventarios/${aberto.json.id}/itens`, [
      { produtoId: d.racao.id, quantidadeContada: 90 },
      { produtoId: d.vacina.id, loteFabricacao: "L1", quantidadeContada: 50 },
      { produtoId: d.vacina.id, loteFabricacao: "L2", quantidadeContada: 35 },
      { produtoId: d.desinfetante.id, quantidadeContada: 4 },
    ]);
    expect(contar.status).toBe(200);

    const fechado = await chamar(d.f.membro, "POST", `${d.base}/inventarios/${aberto.json.id}/fechar`);
    expect(fechado.status).toBe(200);
    expect(fechado.json.status).toBe("fechado");
    const porItem = Object.fromEntries(
      fechado.json.itens.map((i: { produtoNome: string; loteFabricacao: string; quantidadeSistema: number; diferenca: number }) => [
        `${i.produtoNome}|${i.loteFabricacao}`,
        [i.quantidadeSistema, i.diferenca],
      ]),
    );
    expect(porItem).toEqual({ "Ração|": [100, -10], "Newcastle|L1": [50, 0], "Newcastle|L2": [30, 5], "Desinfetante|": [0, 4] });

    const ajustes = await db
      .select()
      .from(movimentoEstoque)
      .where(and(eq(movimentoEstoque.organizationId, d.f.orgId), eq(movimentoEstoque.origemTipo, "inventario")));
    expect(ajustes.map((a) => Number(a.quantidade)).sort((x, y) => x - y)).toEqual([-10, 4, 5]);
    expect(ajustes.every((a) => a.tipo === "ajuste" && a.origemId === aberto.json.id && a.motivo === "inventário")).toBe(true);

    expect((await d.saldoDe(d.racao.id)).total).toBe(90);
    expect((await d.saldoDe(d.vacina.id)).total).toBe(85);
    expect((await d.saldoDe(d.desinfetante.id)).total).toBe(4);
  });

  it("segundo inventário aberto no mesmo local 409; em outro local pode", async () => {
    const d = await deposito();
    await chamar(d.f.dono, "POST", `${d.base}/inventarios`, { localId: d.local.id });
    const segundo = await chamar(d.f.dono, "POST", `${d.base}/inventarios`, { localId: d.local.id });
    expect(segundo).toMatchObject({ status: 409, json: { error: "Já há um inventário aberto neste local." } });
    expect((await chamar(d.f.dono, "POST", `${d.base}/inventarios`, { localId: d.outro.id })).status).toBe(201);
  });

  it("fechar sem itens 400; fechado não aceita contagem nem fecha de novo", async () => {
    const d = await deposito();
    const inv = (await chamar(d.f.dono, "POST", `${d.base}/inventarios`, { localId: d.local.id })).json;
    expect(await chamar(d.f.dono, "POST", `${d.base}/inventarios/${inv.id}/fechar`)).toMatchObject({
      status: 400,
      json: { error: "Conte pelo menos um produto." },
    });

    await chamar(d.f.dono, "PUT", `${d.base}/inventarios/${inv.id}/itens`, [{ produtoId: d.racao.id, quantidadeContada: 100 }]);
    expect((await chamar(d.f.dono, "POST", `${d.base}/inventarios/${inv.id}/fechar`)).status).toBe(200);
    const conta = await chamar(d.f.dono, "PUT", `${d.base}/inventarios/${inv.id}/itens`, [{ produtoId: d.racao.id, quantidadeContada: 1 }]);
    expect(conta).toMatchObject({ status: 409, json: { error: "Este inventário não está aberto." } });
    expect((await chamar(d.f.dono, "POST", `${d.base}/inventarios/${inv.id}/fechar`)).status).toBe(409);
  });

  it("cancelar libera o local para outro inventário e não mexe no saldo", async () => {
    const d = await deposito();
    const inv = (await chamar(d.f.dono, "POST", `${d.base}/inventarios`, { localId: d.local.id })).json;
    await chamar(d.f.dono, "PUT", `${d.base}/inventarios/${inv.id}/itens`, [{ produtoId: d.racao.id, quantidadeContada: 1 }]);
    const c = await chamar(d.f.dono, "POST", `${d.base}/inventarios/${inv.id}/cancelar`);
    expect(c).toMatchObject({ status: 200, json: { status: "cancelado" } });
    expect((await d.saldoDe(d.racao.id)).total).toBe(100);
    expect((await chamar(d.f.dono, "POST", `${d.base}/inventarios`, { localId: d.local.id })).status).toBe(201);

    const lista = await chamar(d.f.dono, "GET", `${d.base}/inventarios`);
    expect(lista.json.map((i: { status: string }) => i.status).sort()).toEqual(["aberto", "cancelado"]);
  });

  it("outra fazenda não vê nem conta; produto de fora 404", async () => {
    const d = await deposito();
    const fora = await criarFazenda(`Inventario fora ${n}`);
    const alheio = (await chamar(fora.dono, "POST", `/api/org/${fora.orgId}/estoque/produtos`, { nome: "X", categoria: "outro", unidade: "un" })).json;
    const inv = (await chamar(d.f.dono, "POST", `${d.base}/inventarios`, { localId: d.local.id })).json;

    expect((await chamar(fora.dono, "GET", `${d.base}/inventarios`)).status).toBe(403);
    expect((await chamar(fora.dono, "POST", `${d.base}/inventarios/${inv.id}/fechar`)).status).toBe(403);
    expect((await chamar(fora.dono, "GET", `/api/org/${fora.orgId}/estoque/inventarios/${inv.id}`)).status).toBe(404);
    const comAlheio = await chamar(d.f.dono, "PUT", `${d.base}/inventarios/${inv.id}/itens`, [{ produtoId: alheio.id, quantidadeContada: 1 }]);
    expect(comAlheio).toMatchObject({ status: 404, json: { error: "Produto não encontrado." } });
  });
});
