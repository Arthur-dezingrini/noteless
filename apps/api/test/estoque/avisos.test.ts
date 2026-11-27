import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { hojeISO, noDia } from "../../src/base/datas";
import { db } from "../../src/db";
import { apontamentoAviario } from "../../src/db/tabelas/aviario";
import { notificacao } from "../../src/db/tabelas/avisos";
import { env } from "../../src/env";
import { conferirAvisosEstoque, resumoAvisosEstoque } from "../../src/modulos/estoque";
import { lancarMovimento } from "../../src/modulos/estoque/regras/movimento";
import { chamar, criarFazenda } from "../ajuda";

const HOJE = hojeISO();
let n = 0;

/**
 * Granja com um de cada aviso: ração abaixo do mínimo e acabando no silo,
 * vacina vencendo e vencida, desinfetante negativo e ração lançada num
 * galpão sem silo (como chega pela nota de voz, sem baixa).
 */
async function granja() {
  n += 1;
  const f = await criarFazenda(`Avisos Estoque ${n}`);
  const org = `/api/org/${f.orgId}`;
  const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${org}/${caminho}`, corpo)).json;
  const g1 = await post("instalacoes", { nome: "Galpão 1", tipo: "galpao" });
  const g2 = await post("instalacoes", { nome: "Galpão 2", tipo: "galpao" });
  const lote = await post("lotes", {
    codigo: "L-1",
    dataAlojamento: noDia(HOJE, -30),
    galpoes: [
      { instalacaoId: g1.id, femeas: 100, machos: 10 },
      { instalacaoId: g2.id, femeas: 100, machos: 10 },
    ],
  });
  const silo = await post("estoque/locais", { nome: "Silo 1", tipo: "silo", instalacaoId: g1.id });
  const deposito = await post("estoque/locais", { nome: "Depósito", tipo: "deposito" });
  const racao = await post("estoque/produtos", { nome: "Ração postura", categoria: "racao", unidade: "kg", estoqueMinimo: 1000 });
  const vacina = await post("estoque/produtos", { nome: "Newcastle", categoria: "vacina", unidade: "dose" });
  const desinfetante = await post("estoque/produtos", { nome: "Desinfetante", categoria: "material", unidade: "l" });

  const mov = { orgId: f.orgId, userId: null };
  await db.transaction(async (tx) => {
    await lancarMovimento(tx, { ...mov, produtoId: racao.id, localId: silo.id, tipo: "entrada", quantidade: 1200, data: noDia(HOJE, -10), origemTipo: "manual" });
    for (let d = 0; d < 7; d++) {
      await lancarMovimento(tx, { ...mov, produtoId: racao.id, localId: silo.id, tipo: "saida", quantidade: -100, data: noDia(HOJE, -d), origemTipo: "apontamento_aviario", origemId: `x${d}` });
    }
    await lancarMovimento(tx, { ...mov, produtoId: vacina.id, localId: deposito.id, tipo: "entrada", quantidade: 100, loteFabricacao: "V1", validade: noDia(HOJE, 10), data: HOJE, origemTipo: "manual" });
    await lancarMovimento(tx, { ...mov, produtoId: vacina.id, localId: deposito.id, tipo: "entrada", quantidade: 5, loteFabricacao: "V0", validade: noDia(HOJE, -1), data: HOJE, origemTipo: "manual" });
    await lancarMovimento(tx, { ...mov, produtoId: desinfetante.id, localId: deposito.id, tipo: "saida", quantidade: -2, data: HOJE, origemTipo: "manual" });
  });
  await db.insert(apontamentoAviario).values({ organizationId: f.orgId, instalacaoId: g2.id, loteId: lote.id ?? lote.lote?.id, data: HOJE, racaoKg: "50" });

  const textos = async () => {
    const rows = await db
      .select({ texto: notificacao.texto })
      .from(notificacao)
      .where(and(eq(notificacao.organizationId, f.orgId), eq(notificacao.userId, f.dono.id)));
    return rows.map((r) => r.texto).sort();
  };
  return { f, textos };
}

describe("avisos diários do estoque", () => {
  afterEach(() => {
    env.ROTINAS_SEGREDO = undefined;
  });

  it("gera um aviso de cada tipo para os administradores", async () => {
    const g = await granja();
    await conferirAvisosEstoque(new Date());
    expect(await g.textos()).toEqual(
      [
        "Saldo negativo: Desinfetante em Depósito",
        "Newcastle lote V0 venceu",
        "Newcastle lote V1 vence em 10 dias",
        "Ração do Galpão 2 não saiu do estoque",
        "Ração do Silo 1 acaba em 5 dias",
        "Ração postura abaixo do mínimo",
      ].sort(),
    );
    const admin = await db.select().from(notificacao).where(and(eq(notificacao.organizationId, g.f.orgId), eq(notificacao.userId, g.f.admin.id)));
    expect(admin).toHaveLength(6);
    const membro = await db.select().from(notificacao).where(and(eq(notificacao.organizationId, g.f.orgId), eq(notificacao.userId, g.f.membro.id)));
    expect(membro).toHaveLength(0);

    expect(await resumoAvisosEstoque(g.f.orgId)).toEqual({ abaixoMinimo: 1, acabando: 1, vencendo: 2, negativos: 1, semBaixa: 1 });
  });

  it("rodar duas vezes no mesmo dia não duplica", async () => {
    const g = await granja();
    await conferirAvisosEstoque(new Date());
    const antes = (await g.textos()).length;
    await conferirAvisosEstoque(new Date());
    expect((await g.textos()).length).toBe(antes);
  });

  it("fazenda sem produto no estoque não recebe aviso; a de uma não avisa a outra", async () => {
    const g = await granja();
    const vazia = await criarFazenda(`Avisos Estoque vazia ${n}`);
    await conferirAvisosEstoque(new Date());
    const daVazia = await db
      .select()
      .from(notificacao)
      .where(and(eq(notificacao.organizationId, vazia.orgId), inArray(notificacao.userId, [vazia.dono.id, vazia.admin.id])));
    expect(daVazia).toHaveLength(0);
    expect(await resumoAvisosEstoque(vazia.orgId)).toEqual({ abaixoMinimo: 0, acabando: 0, vencendo: 0, negativos: 0, semBaixa: 0 });
    expect((await g.textos()).length).toBe(6);
  });

  it("organização com aviário e sem silo não vê aviso de ração sem baixa", async () => {
    const f = await criarFazenda(`Avisos sem silo ${n}`);
    const org = `/api/org/${f.orgId}`;
    const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${org}/${caminho}`, corpo)).json;
    const g1 = await post("instalacoes", { nome: "Galpão 1", tipo: "galpao" });
    const lote = await post("lotes", { codigo: "L-1", dataAlojamento: noDia(HOJE, -30), galpoes: [{ instalacaoId: g1.id, femeas: 100, machos: 10 }] });
    await post("estoque/produtos", { nome: "Desinfetante", categoria: "material", unidade: "l" });
    const r = await chamar(f.dono, "PUT", `${org}/lotes/${lote.id ?? lote.lote?.id}/apontamentos/${g1.id}/${HOJE}`, { racaoKg: 80 });
    expect(r.status).toBe(200);
    await conferirAvisosEstoque(new Date());
    const avisos = await db.select().from(notificacao).where(eq(notificacao.organizationId, f.orgId));
    expect(avisos).toHaveLength(0);
    expect((await resumoAvisosEstoque(f.orgId)).semBaixa).toBe(0);
  });

  it("o aviso imediato de saldo negativo não se repete no mesmo dia", async () => {
    const f = await criarFazenda(`Avisos repetidos ${n}`);
    const base = `/api/org/${f.orgId}/estoque`;
    const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${base}/${caminho}`, corpo)).json;
    const p = await post("produtos", { nome: "Iodo", categoria: "material", unidade: "l" });
    const l = await post("locais", { nome: "Farmácia", tipo: "farmacia" });
    for (let i = 0; i < 3; i++) await post("movimentos/saida", { produtoId: p.id, localId: l.id, quantidade: 1, data: HOJE, confirmarNegativo: true });
    const doDono = await db.select().from(notificacao).where(and(eq(notificacao.organizationId, f.orgId), eq(notificacao.userId, f.dono.id)));
    expect(doDono.map((x) => x.texto)).toEqual(["Saldo negativo: Iodo em Farmácia"]);
  });

  it("trocar a ração no mesmo silo não dá aviso de ração acabando: conta o silo inteiro", async () => {
    const f = await criarFazenda(`Avisos troca de ração ${n}`);
    const org = `/api/org/${f.orgId}`;
    const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${org}/${caminho}`, corpo)).json;
    const g1 = await post("instalacoes", { nome: "Galpão 1", tipo: "galpao" });
    const silo = await post("estoque/locais", { nome: "Silo 1", tipo: "silo", instalacaoId: g1.id });
    const inicial = await post("estoque/produtos", { nome: "Ração inicial", categoria: "racao", unidade: "kg" });
    const crescimento = await post("estoque/produtos", { nome: "Ração crescimento", categoria: "racao", unidade: "kg" });
    const mov = { orgId: f.orgId, userId: null, localId: silo.id };
    await db.transaction(async (tx) => {
      await lancarMovimento(tx, { ...mov, produtoId: inicial.id, tipo: "entrada", quantidade: 700, data: noDia(HOJE, -8), origemTipo: "manual" });
      for (let d = 0; d < 7; d++) {
        await lancarMovimento(tx, { ...mov, produtoId: inicial.id, tipo: "saida", quantidade: -100, data: noDia(HOJE, -d), origemTipo: "apontamento_aviario", origemId: `t${d}` });
      }
      await lancarMovimento(tx, { ...mov, produtoId: crescimento.id, tipo: "entrada", quantidade: 2000, data: HOJE, origemTipo: "manual" });
    });
    expect((await resumoAvisosEstoque(f.orgId)).acabando).toBe(0);

    // Silo inteiro: 2000 kg para 100 kg/dia. Acabando de verdade (a 300 kg) volta a avisar.
    await db.transaction((tx) =>
      lancarMovimento(tx, { ...mov, produtoId: crescimento.id, tipo: "saida", quantidade: -1700, data: HOJE, origemTipo: "manual" }),
    );
    expect((await resumoAvisosEstoque(f.orgId)).acabando).toBe(1);
  });

  it("a rota da rotina exige o segredo", async () => {
    const chamarRotina = (autorizacao?: string) =>
      app.request("/api/rotinas/estoque-avisos", { method: "POST", headers: autorizacao ? { Authorization: autorizacao } : {} });
    expect((await chamarRotina()).status).toBe(503);
    env.ROTINAS_SEGREDO = "s".repeat(64);
    expect((await chamarRotina()).status).toBe(401);
    expect((await chamarRotina("Bearer errado")).status).toBe(401);
    const ok = await chamarRotina(`Bearer ${"s".repeat(64)}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ avisos: expect.any(Number) });
  });
});
