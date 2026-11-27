import type { Operacao } from "@vocare/shared";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { hojeISO } from "../../src/base/datas";
import { db } from "../../src/db";
import { animal } from "../../src/db/tabelas/animais";
import { entrada, movimentoEstoque } from "../../src/db/tabelas/estoque";
import { grupo, grupoAnimal, tratamento, vacina } from "../../src/db/tabelas/historico";
import { ocorrencia } from "../../src/db/tabelas/notas";
import { chamar, criarFazenda } from "../ajuda";

const HOJE = hojeISO();
const base = { titulo: "", detalhe: "", confianca: 90, trecho: "", animalId: null, grupoId: null };
let n = 0;

async function granja() {
  n += 1;
  const f = await criarFazenda(`Voz Estoque ${n}`);
  const api = `/api/org/${f.orgId}/estoque`;
  const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${api}/${caminho}`, corpo)).json;
  const racao = await post("produtos", { nome: "Ração postura", categoria: "racao", unidade: "kg" });
  const vac = await post("produtos", { nome: "Newcastle", categoria: "vacina", unidade: "dose" });
  const remedio = await post("produtos", { nome: "Enrofloxacina", categoria: "medicamento", unidade: "ml", controlaLote: false });
  const deposito = await post("locais", { nome: "Depósito", tipo: "deposito" });
  const geladeira = await post("locais", { nome: "Geladeira", tipo: "geladeira" });
  await post("entradas", {
    data: HOJE,
    itens: [
      { produtoId: racao.id, localId: deposito.id, quantidade: 1000, custoTotal: 2000 },
      { produtoId: vac.id, localId: geladeira.id, quantidade: 500, loteFabricacao: "V1", validade: "2027-06-30" },
      { produtoId: remedio.id, localId: geladeira.id, quantidade: 1000 },
    ],
  });

  /** Grava uma nota pendente com as operações e confirma todas. */
  const confirmar = async (operacoes: Operacao[]) => {
    const [o] = await db
      .insert(ocorrencia)
      .values({ organizationId: f.orgId, criadoPorId: f.membro.id, transcricao: "x", resumo: "x", operacoes })
      .returning({ id: ocorrencia.id });
    const r = await chamar(f.admin, "POST", `/api/org/${f.orgId}/ocorrencias/${o!.id}/confirmar`, { operacoes: operacoes.map((_, i) => i) });
    return { ...r, id: o!.id };
  };
  const saldo = async (produtoId: string) =>
    (await chamar(f.dono, "GET", `${api}/saldo`)).json.find((s: { produto: { id: string } }) => s.produto.id === produtoId).total as number;
  return { f, racao, vac, remedio, deposito, geladeira, confirmar, saldo };
}

const estoqueOp = (tipo: "entrada_estoque" | "saida_estoque", extra: Record<string, unknown>) =>
  ({ ...base, alvo: "ração", tipo, produto: "ração", local: null, unidade: "kg", data: null, ...extra }) as unknown as Operacao;

describe("estoque pela nota de voz", () => {
  it("aprovar entrada_estoque cria a entrada e o saldo", async () => {
    const g = await granja();
    const r = await g.confirmar([
      estoqueOp("entrada_estoque", { produtoId: g.racao.id, localId: g.deposito.id, quantidade: 7500, fornecedor: null, numeroNota: "99", valorTotal: 15000, loteFabricacao: null, validade: null }),
    ]);
    expect(r.status).toBe(200);
    expect(await g.saldo(g.racao.id)).toBe(8500);
    const [e] = await db.select().from(entrada).where(and(eq(entrada.organizationId, g.f.orgId), eq(entrada.origem, "voz")));
    expect(e).toMatchObject({ ocorrenciaId: r.id, numeroNota: "99", valorTotal: "15000.00" });
  });

  it("produto escolhido na conferência converte os sacos ditos para kg", async () => {
    const g = await granja();
    await chamar(g.f.dono, "PATCH", `/api/org/${g.f.orgId}/estoque/produtos/${g.racao.id}`, { embalagemNome: "saco", embalagemFator: 25 });
    // A IA não achou o produto: ficou "300 sacos"; quem conferiu escolheu a ração.
    const r = await g.confirmar([
      estoqueOp("entrada_estoque", { produtoId: g.racao.id, localId: g.deposito.id, quantidade: 300, unidade: "sacos", fornecedor: null, numeroNota: null, valorTotal: null, loteFabricacao: null, validade: null }),
    ]);
    expect(r.status).toBe(200);
    expect(await g.saldo(g.racao.id)).toBe(1000 + 7500);
  });

  it("aprovar saida_estoque baixa por FEFO com a nota como origem", async () => {
    const g = await granja();
    const r = await g.confirmar([estoqueOp("saida_estoque", { produtoId: g.vac.id, localId: g.geladeira.id, quantidade: 100, motivo: "perda" })]);
    expect(r.status).toBe(200);
    expect(await g.saldo(g.vac.id)).toBe(400);
    const [m] = await db
      .select()
      .from(movimentoEstoque)
      .where(and(eq(movimentoEstoque.organizationId, g.f.orgId), eq(movimentoEstoque.origemTipo, "ocorrencia")));
    expect(m).toMatchObject({ origemId: `${r.id}:0`, loteFabricacao: "V1", motivo: "perda", ocorrenciaId: r.id });
  });

  it("sem produto ou local reconhecido não aprova e explica", async () => {
    const g = await granja();
    const r = await g.confirmar([estoqueOp("entrada_estoque", { produtoId: null, localId: g.deposito.id, quantidade: 10, fornecedor: null, numeroNota: null, valorTotal: null, loteFabricacao: null, validade: null })]);
    expect(r).toMatchObject({ status: 400, json: { error: expect.stringContaining("Escolha o produto e o local do estoque.") } });
    expect(await g.saldo(g.racao.id)).toBe(1000);
  });

  it("aplicar_vacina com produto baixa uma dose por animal do grupo; registrar_remedio baixa a quantidade por animal", async () => {
    const g = await granja();
    const animais = await db
      .insert(animal)
      .values([1, 2, 3].map((i) => ({ organizationId: g.f.orgId, nome: `Ave ${i}`, especie: "ave" })))
      .returning({ id: animal.id });
    const [gr] = await db.insert(grupo).values({ organizationId: g.f.orgId, nome: "Matrizes" }).returning({ id: grupo.id });
    await db.insert(grupoAnimal).values(animais.map((a) => ({ grupoId: gr!.id, animalId: a.id })));

    const vacinar = { ...base, alvo: "matrizes", grupoId: gr!.id, tipo: "aplicar_vacina", vacina: "Newcastle", dose: null, data: null, proximaData: null, produtoId: g.vac.id } as Operacao;
    const remediar = { ...base, alvo: "Ave 1", animalId: animais[0]!.id, tipo: "registrar_remedio", remedio: "Enrofloxacina", dose: "5 ml", dias: 3, carenciaDias: null, produtoId: g.remedio.id, quantidade: 5 } as Operacao;
    const r = await g.confirmar([vacinar, remediar]);
    expect(r.status).toBe(200);
    expect(await g.saldo(g.vac.id)).toBe(497);
    expect(await g.saldo(g.remedio.id)).toBe(995);
    const vacinas = await db.select().from(vacina).where(eq(vacina.ocorrenciaId, r.id));
    expect(vacinas).toHaveLength(3);
    expect(vacinas.every((v) => v.produtoId === g.vac.id && v.quantidade === "1.000")).toBe(true);
    const [t] = await db.select().from(tratamento).where(eq(tratamento.ocorrenciaId, r.id));
    expect(t).toMatchObject({ produtoId: g.remedio.id, quantidade: "5.000" });
  });

  it("produto de outra fazenda não aplica nada", async () => {
    const g = await granja();
    const fora = await granja();
    const r = await g.confirmar([estoqueOp("saida_estoque", { produtoId: fora.racao.id, localId: g.deposito.id, quantidade: 1, motivo: null })]);
    expect(r.status).toBe(400);
    expect(await fora.saldo(fora.racao.id)).toBe(1000);
  });
});
