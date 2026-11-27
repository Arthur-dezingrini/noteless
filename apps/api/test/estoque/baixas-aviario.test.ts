import type { Operacao } from "@vocare/shared";
import { and, eq, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { hojeISO, noDia } from "../../src/base/datas";
import { db } from "../../src/db";
import { vacinacaoLote } from "../../src/db/tabelas/aviario";
import { notificacao } from "../../src/db/tabelas/avisos";
import { movimentoEstoque } from "../../src/db/tabelas/estoque";
import { aplicarAviario } from "../../src/modulos/aviario";
import { chamar, criarFazenda } from "../ajuda";

const HOJE = hojeISO();
let n = 0;

/** Granja com Galpão 1 (com silo e 5000 kg de ração), Galpão 2 (sem silo), lote L-1 nos dois e vacina na geladeira. */
async function granja() {
  n += 1;
  const f = await criarFazenda(`Baixa Aviario ${n}`);
  const org = `/api/org/${f.orgId}`;
  const post = async (caminho: string, corpo: unknown) => {
    const r = await chamar(f.dono, "POST", `${org}/${caminho}`, corpo);
    expect(r.status, `${caminho}: ${JSON.stringify(r.json)}`).toBeLessThan(300);
    return r.json;
  };
  const g1 = await post("instalacoes", { nome: "Galpão 1", tipo: "galpao" });
  const g2 = await post("instalacoes", { nome: "Galpão 2", tipo: "galpao" });
  const lote = await post("lotes", {
    codigo: "L-1",
    dataAlojamento: noDia(HOJE, -30),
    galpoes: [
      { instalacaoId: g1.id, femeas: 1000, machos: 100 },
      { instalacaoId: g2.id, femeas: 500, machos: 50 },
    ],
  });
  const silo = await post("estoque/locais", { nome: "Silo 1", tipo: "silo", instalacaoId: g1.id });
  const geladeira = await post("estoque/locais", { nome: "Geladeira", tipo: "geladeira" });
  const racao = await post("estoque/produtos", { nome: "Ração postura", categoria: "racao", unidade: "kg" });
  const vacina = await post("estoque/produtos", { nome: "Newcastle", categoria: "vacina", unidade: "dose" });
  await post("estoque/entradas", {
    data: noDia(HOJE, -20),
    itens: [
      { produtoId: racao.id, localId: silo.id, quantidade: 5000, custoTotal: 10000 },
      { produtoId: vacina.id, localId: geladeira.id, quantidade: 5000, loteFabricacao: "V1", validade: "2027-06-30" },
    ],
  });

  const loteId = lote.id ?? lote.lote?.id;
  const apontar = (instalacaoId: string, data: string, valores: Record<string, unknown>) =>
    chamar(f.dono, "PUT", `${org}/lotes/${loteId}/apontamentos/${instalacaoId}/${data}`, valores);
  const saldo = async (produtoId: string) => {
    const r = await chamar(f.dono, "GET", `${org}/estoque/saldo`);
    return r.json.find((s: { produto: { id: string } }) => s.produto.id === produtoId).total as number;
  };
  const movimentos = (origemTipo: string) =>
    db
      .select()
      .from(movimentoEstoque)
      .where(and(eq(movimentoEstoque.organizationId, f.orgId), eq(movimentoEstoque.origemTipo, origemTipo)));
  return { f, org, g1, g2, loteId, silo, geladeira, racao, vacina, apontar, saldo, movimentos };
}

describe("o aviário dá baixa no estoque", () => {
  it("registro diário pela tela baixa a ração do silo; salvar de novo sem mudar a ração não mexe", async () => {
    const g = await granja();
    const r = await g.apontar(g.g1.id, HOJE, { racaoKg: 200, mortasFemeas: 3 });
    expect(r.status).toBe(200);
    expect(await g.saldo(g.racao.id)).toBe(4800);

    await g.apontar(g.g1.id, HOJE, { racaoKg: 200, mortasFemeas: 5 });
    expect(await g.movimentos("apontamento_aviario")).toHaveLength(1);
    expect(await g.saldo(g.racao.id)).toBe(4800);

    await g.apontar(g.g1.id, HOJE, { racaoKg: 180, mortasFemeas: 5 });
    expect(await g.saldo(g.racao.id)).toBe(4820);
  });

  it("nota que soma 100 kg no mesmo dia baixa só mais 100", async () => {
    const g = await granja();
    await g.apontar(g.g1.id, HOJE, { racaoKg: 200 });
    const op = { tipo: "apontar_galpao", instalacaoId: g.g1.id, data: HOJE, racaoKg: 100, observacoes: null } as unknown as Operacao;
    const erro = await db.transaction((tx) =>
      aplicarAviario(tx, op, { organizationId: g.f.orgId, criadoPorId: g.f.dono.id, ocorrenciaId: null as unknown as string }, HOJE),
    );
    expect(erro).toBeNull();
    expect(await g.saldo(g.racao.id)).toBe(4700);
  });

  it("galpão sem silo não baixa e avisa os administradores", async () => {
    const g = await granja();
    const r = await g.apontar(g.g2.id, HOJE, { racaoKg: 100 });
    expect(r.status).toBe(200);
    expect(await g.movimentos("apontamento_aviario")).toHaveLength(0);
    const avisos = await db
      .select()
      .from(notificacao)
      .where(and(eq(notificacao.organizationId, g.f.orgId), like(notificacao.texto, "Ração do Galpão 2 não saiu do estoque")));
    expect(avisos.length).toBe(2); // dono e admin
  });

  it("vacinação de lote com produto baixa as aves vivas do dia", async () => {
    const g = await granja();
    await g.apontar(g.g1.id, noDia(HOJE, -2), { mortasFemeas: 10 });
    const r = await chamar(g.f.dono, "POST", `${g.org}/lotes/${g.loteId}/vacinacoes`, { data: HOJE, vacina: "Newcastle", produtoId: g.vacina.id });
    expect(r.status).toBe(201);
    // 1650 alojadas − 10 mortas antes de hoje.
    expect(await g.saldo(g.vacina.id)).toBe(5000 - 1640);
    const [v] = await db.select().from(vacinacaoLote).where(eq(vacinacaoLote.organizationId, g.f.orgId));
    expect(v).toMatchObject({ produtoId: g.vacina.id, quantidade: "1640.000" });
    const [m] = await g.movimentos("vacinacao_lote");
    expect(m).toMatchObject({ origemId: v!.id, loteFabricacao: "V1", localId: g.geladeira.id });
  });

  it("vacinar_lote pela nota com produto baixa as aves vivas e grava o produto", async () => {
    const g = await granja();
    const op = { tipo: "vacinar_lote", titulo: "", alvo: "L-1", animalId: null, grupoId: null, detalhe: "", confianca: 90, trecho: "", loteId: g.loteId, vacina: "Newcastle", via: null, data: HOJE, proximaData: null, produtoId: g.vacina.id } as unknown as Operacao;
    const erro = await db.transaction((tx) =>
      aplicarAviario(tx, op, { organizationId: g.f.orgId, criadoPorId: g.f.dono.id, ocorrenciaId: null as unknown as string }, HOJE),
    );
    expect(erro).toBeNull();
    expect(await g.saldo(g.vacina.id)).toBe(5000 - 1650);
    const [v] = await db.select().from(vacinacaoLote).where(eq(vacinacaoLote.organizationId, g.f.orgId));
    expect(v).toMatchObject({ produtoId: g.vacina.id, quantidade: "1650.000" });
  });

  it("vacinação com quantidade informada baixa essa quantidade", async () => {
    const g = await granja();
    await chamar(g.f.dono, "POST", `${g.org}/lotes/${g.loteId}/vacinacoes`, { data: HOJE, vacina: "Newcastle", produtoId: g.vacina.id, quantidade: 500 });
    expect(await g.saldo(g.vacina.id)).toBe(4500);
  });

  it("vacinação com produto de outra fazenda 404 e nada gravado; sem produto continua como antes", async () => {
    const g = await granja();
    const fora = await criarFazenda(`Baixa Aviario fora ${n}`);
    const alheio = (await chamar(fora.dono, "POST", `/api/org/${fora.orgId}/estoque/produtos`, { nome: "X", categoria: "vacina", unidade: "dose" })).json;

    const r = await chamar(g.f.dono, "POST", `${g.org}/lotes/${g.loteId}/vacinacoes`, { data: HOJE, vacina: "X", produtoId: alheio.id });
    expect(r).toMatchObject({ status: 404, json: { error: "Produto não encontrado." } });
    expect(await db.select().from(vacinacaoLote).where(eq(vacinacaoLote.organizationId, g.f.orgId))).toHaveLength(0);

    const sem = await chamar(g.f.dono, "POST", `${g.org}/lotes/${g.loteId}/vacinacoes`, { data: HOJE, vacina: "Gumboro" });
    expect(sem.status).toBe(201);
    expect(await g.movimentos("vacinacao_lote")).toHaveLength(0);
  });
});
