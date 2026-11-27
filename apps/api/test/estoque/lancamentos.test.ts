import { and, eq, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { hojeISO, noDia } from "../../src/base/datas";
import { db } from "../../src/db";
import { notificacao } from "../../src/db/tabelas/avisos";
import { chamar, criarFazenda } from "../ajuda";

let n = 0;
/** Fazenda com ração (saco 25 kg), vacina (controla lote), depósito, silo e geladeira. */
async function granja() {
  n += 1;
  const f = await criarFazenda(`Lancamentos ${n}`);
  const base = `/api/org/${f.orgId}/estoque`;
  const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${base}/${caminho}`, corpo)).json;
  const racao = await post("produtos", { nome: "Ração", categoria: "racao", unidade: "kg", embalagemNome: "saco", embalagemFator: 25 });
  const vacina = await post("produtos", { nome: "Newcastle", categoria: "vacina", unidade: "dose" });
  const deposito = await post("locais", { nome: "Depósito", tipo: "deposito" });
  const silo = await post("locais", { nome: "Silo", tipo: "silo" });
  const geladeira = await post("locais", { nome: "Geladeira", tipo: "geladeira" });
  const fornecedor = await post("fornecedores", { nome: "Agro X" });
  return { f, base, racao, vacina, deposito, silo, geladeira, fornecedor };
}

const HOJE = hojeISO();

async function entrar(g: Awaited<ReturnType<typeof granja>>, quantidade: number, custoTotal?: number) {
  const r = await chamar(g.f.dono, "POST", `${g.base}/entradas`, {
    data: HOJE,
    itens: [{ produtoId: g.racao.id, localId: g.deposito.id, quantidade, custoTotal }],
  });
  expect(r.status).toBe(201);
  return r.json;
}

async function saldoDe(g: Awaited<ReturnType<typeof granja>>, produtoId: string) {
  const r = await chamar(g.f.dono, "GET", `${g.base}/saldo`);
  return r.json.find((s: { produto: { id: string } }) => s.produto.id === produtoId);
}

const avisosNegativos = (orgId: string) =>
  db
    .select()
    .from(notificacao)
    .where(and(eq(notificacao.organizationId, orgId), like(notificacao.texto, "Saldo negativo%")));

describe("lançamentos do estoque", () => {
  it("entrada manual de 2 itens aparece no saldo, no custo e no livro", async () => {
    const g = await granja();
    const r = await chamar(g.f.membro, "POST", `${g.base}/entradas`, {
      fornecedorId: g.fornecedor.id,
      numeroNota: "1234",
      data: HOJE,
      itens: [
        { produtoId: g.racao.id, localId: g.deposito.id, quantidade: 10, fator: 25, custoTotal: 1000 },
        { produtoId: g.vacina.id, localId: g.geladeira.id, quantidade: 2, fator: 1000, custoTotal: 300, loteFabricacao: "L1", validade: "2027-01-31" },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ origem: "tela", numeroNota: "1234", fornecedorNome: "Agro X", valorTotal: 1300, estornadaEm: null });
    expect(r.json.itens).toHaveLength(2);

    const racao = await saldoDe(g, g.racao.id);
    expect(racao).toMatchObject({ total: 250, produto: { custoMedio: 4 } });
    const vacina = await saldoDe(g, g.vacina.id);
    expect(vacina).toMatchObject({ total: 2000, validadeMaisProxima: "2027-01-31", produto: { custoMedio: 0.15 } });
    expect(vacina.porLocal[0]).toMatchObject({ localNome: "Geladeira", quantidade: 2000, lotes: [{ loteFabricacao: "L1", quantidade: 2000 }] });

    const livro = await chamar(g.f.dono, "GET", `${g.base}/movimentos?origemTipo=entrada`);
    expect(livro.json.itens).toHaveLength(2);
    expect(livro.json.temMais).toBe(false);

    const semLote = await chamar(g.f.dono, "POST", `${g.base}/entradas`, {
      data: HOJE,
      itens: [{ produtoId: g.vacina.id, localId: g.geladeira.id, quantidade: 1 }],
    });
    expect(semLote).toMatchObject({ status: 400, json: { error: "Informe o lote e a validade." } });
  });

  it("saída acima do saldo pede confirmação e, confirmada, fica negativa e avisa os administradores", async () => {
    const g = await granja();
    await entrar(g, 100, 200);
    const saida = { produtoId: g.racao.id, localId: g.deposito.id, quantidade: 150, data: HOJE };

    const pede = await chamar(g.f.membro, "POST", `${g.base}/movimentos/saida`, saida);
    expect(pede).toMatchObject({ status: 409, json: { error: "Saldo insuficiente.", saldo: 100 } });
    expect((await saldoDe(g, g.racao.id)).total).toBe(100);

    const vai = await chamar(g.f.membro, "POST", `${g.base}/movimentos/saida`, { ...saida, confirmarNegativo: true, motivo: "perda" });
    expect(vai.status).toBe(201);
    expect(vai.json[0]).toMatchObject({ tipo: "saida", quantidade: -150, custoUnitario: 2, motivo: "perda" });
    expect((await saldoDe(g, g.racao.id)).total).toBe(-50);
    expect((await avisosNegativos(g.f.orgId)).length).toBe(2); // dono e admin
  });

  it("transferência move o saldo e o estorno desfaz os dois lados", async () => {
    const g = await granja();
    await entrar(g, 100, 100);
    const t = await chamar(g.f.dono, "POST", `${g.base}/movimentos/transferencia`, {
      produtoId: g.racao.id,
      deLocalId: g.deposito.id,
      paraLocalId: g.silo.id,
      quantidade: 40,
      data: HOJE,
    });
    expect(t.status).toBe(201);
    expect(t.json.map((m: { quantidade: number }) => m.quantidade).sort()).toEqual([-40, 40]);

    const porLocal = async () =>
      Object.fromEntries((await saldoDe(g, g.racao.id)).porLocal.map((l: { localNome: string; quantidade: number }) => [l.localNome, l.quantidade]));
    expect(await porLocal()).toEqual({ Depósito: 60, Silo: 40 });

    const est = await chamar(g.f.dono, "POST", `${g.base}/movimentos/${t.json[0].id}/estorno`, { motivo: "silo errado" });
    expect(est.status).toBe(200);
    expect(est.json).toHaveLength(2);
    expect(await porLocal()).toEqual({ Depósito: 100, Silo: 0 });

    const deNovo = await chamar(g.f.dono, "POST", `${g.base}/movimentos/${t.json[1].id}/estorno`, { motivo: "x" });
    expect(deNovo).toMatchObject({ status: 409, json: { error: "Este movimento já foi estornado." } });
  });

  it("estornar entrada já consumida deixa negativo, avisa e recalcula o custo", async () => {
    const g = await granja();
    await entrar(g, 100, 200);
    const segunda = await entrar(g, 100, 400);
    expect((await saldoDe(g, g.racao.id)).produto.custoMedio).toBe(3);
    await chamar(g.f.dono, "POST", `${g.base}/movimentos/saida`, { produtoId: g.racao.id, localId: g.deposito.id, quantidade: 150, data: HOJE });

    const est = await chamar(g.f.dono, "POST", `${g.base}/entradas/${segunda.id}/estorno`, { motivo: "nota cancelada" });
    expect(est.status).toBe(200);
    expect(est.json.estornadaEm).not.toBeNull();
    const s = await saldoDe(g, g.racao.id);
    expect(s.total).toBe(-50);
    expect(s.produto.custoMedio).toBe(2);
    expect((await avisosNegativos(g.f.orgId)).length).toBeGreaterThan(0);

    const deNovo = await chamar(g.f.dono, "POST", `${g.base}/entradas/${segunda.id}/estorno`, { motivo: "x" });
    expect(deNovo).toMatchObject({ status: 409, json: { error: "Esta entrada já foi estornada." } });
  });

  it("filtra o livro por lote de fabricação e por origem", async () => {
    const g = await granja();
    await chamar(g.f.dono, "POST", `${g.base}/entradas`, {
      data: HOJE,
      itens: [
        { produtoId: g.vacina.id, localId: g.geladeira.id, quantidade: 100, loteFabricacao: "L1", validade: "2027-01-31" },
        { produtoId: g.vacina.id, localId: g.geladeira.id, quantidade: 100, loteFabricacao: "L2", validade: "2027-03-31" },
      ],
    });
    await chamar(g.f.dono, "POST", `${g.base}/movimentos/saida`, { produtoId: g.vacina.id, localId: g.geladeira.id, quantidade: 30, data: HOJE });

    const l1 = await chamar(g.f.dono, "GET", `${g.base}/movimentos?loteFabricacao=L1`);
    expect(l1.json.itens.map((m: { quantidade: number }) => m.quantidade).sort()).toEqual([-30, 100]);
    const manual = await chamar(g.f.dono, "GET", `${g.base}/movimentos?origemTipo=manual`);
    expect(manual.json.itens).toHaveLength(1);
    expect(manual.json.itens[0]).toMatchObject({ loteFabricacao: "L1", produtoNome: "Newcastle", localNome: "Geladeira", estornado: false });
  });

  it("outra fazenda não lança nem lê; produto de fora 404; data no futuro 422", async () => {
    const g = await granja();
    const outra = await criarFazenda(`Lancamentos fora ${n}`);
    const alheio = (await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/estoque/produtos`, { nome: "X", categoria: "outro", unidade: "un" })).json;
    const saida = { produtoId: g.racao.id, localId: g.deposito.id, quantidade: 1, data: HOJE };

    for (const [metodo, caminho] of [
      ["POST", "movimentos/saida"],
      ["GET", "movimentos"],
      ["GET", "saldo"],
      ["GET", "entradas"],
    ] as const) {
      expect((await chamar(outra.dono, metodo, `${g.base}/${caminho}`, metodo === "POST" ? saida : undefined)).status).toBe(403);
    }
    const fora = await chamar(g.f.dono, "POST", `${g.base}/movimentos/saida`, { ...saida, produtoId: alheio.id });
    expect(fora).toMatchObject({ status: 404, json: { error: "Produto não encontrado." } });
    const futuro = await chamar(g.f.dono, "POST", `${g.base}/movimentos/saida`, { ...saida, data: noDia(HOJE, 1) });
    expect(futuro).toMatchObject({ status: 422, json: { error: "Data no futuro." } });

    await chamar(g.f.dono, "PATCH", `${g.base}/locais/${g.deposito.id}`, { ativo: false });
    const inativo = await chamar(g.f.dono, "POST", `${g.base}/movimentos/saida`, saida);
    expect(inativo).toMatchObject({ status: 400, json: { error: "Local inativo." } });
  });
});
