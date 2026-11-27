import { describe, expect, it } from "vitest";

import { hojeISO, noDia } from "../../src/base/datas";
import { db } from "../../src/db";
import { estornarMovimento, lancarMovimento } from "../../src/modulos/estoque/regras/movimento";
import { chamar, criarFazenda } from "../ajuda";

describe("saldo do estoque", () => {
  it("mostra quantos dias a ração aguenta pela média de 7 dias, sem contar estorno", async () => {
    const f = await criarFazenda("Saldo Dias");
    const base = `/api/org/${f.orgId}/estoque`;
    const racao = (await chamar(f.dono, "POST", `${base}/produtos`, { nome: "Ração", categoria: "racao", unidade: "kg" })).json;
    const material = (await chamar(f.dono, "POST", `${base}/produtos`, { nome: "Desinfetante", categoria: "material", unidade: "l" })).json;
    const silo = (await chamar(f.dono, "POST", `${base}/locais`, { nome: "Silo", tipo: "silo" })).json;
    const hoje = hojeISO();
    const mov = { orgId: f.orgId, userId: null, produtoId: racao.id, localId: silo.id };

    await db.transaction(async (tx) => {
      await lancarMovimento(tx, { ...mov, tipo: "entrada", quantidade: 2600, data: noDia(hoje, -10), origemTipo: "manual" });
      for (let d = 0; d < 7; d++) {
        await lancarMovimento(tx, { ...mov, tipo: "saida", quantidade: -200, data: noDia(hoje, -d), origemTipo: "apontamento_aviario", origemId: `ap${d}` });
      }
    });
    // Saída antiga (fora dos 7 dias) e saída estornada não entram na média.
    const { id: errada } = await db.transaction(async (tx) => {
      await lancarMovimento(tx, { ...mov, tipo: "saida", quantidade: -100, data: noDia(hoje, -9), origemTipo: "apontamento_aviario", origemId: "velha" });
      return lancarMovimento(tx, { ...mov, tipo: "saida", quantidade: -100, data: hoje, origemTipo: "apontamento_aviario", origemId: "errada" });
    });
    await db.transaction((tx) => estornarMovimento(tx, f.orgId, null, errada, "x"));

    const r = await chamar(f.membro, "GET", `${base}/saldo`);
    expect(r.status).toBe(200);
    const s = r.json.find((x: { produto: { id: string } }) => x.produto.id === racao.id);
    // 2600 − 1400 − 100 = 1100; consumo 1400 em 7 dias = 200/dia → 5 dias.
    expect(s).toMatchObject({ total: 1100, diasRestantes: 5 });
    expect(s.porLocal[0]).toMatchObject({ localNome: "Silo", quantidade: 1100, diasRestantes: 5 });

    // Produto sem saldo também aparece; o filtro por categoria esconde os outros.
    const todos = r.json.map((x: { produto: { nome: string } }) => x.produto.nome).sort();
    expect(todos).toEqual(["Desinfetante", "Ração"]);
    const soMaterial = await chamar(f.dono, "GET", `${base}/saldo?categoria=material`);
    expect(soMaterial.json).toEqual([expect.objectContaining({ produto: expect.objectContaining({ id: material.id }), total: 0, diasRestantes: null })]);
  });
});
