import { describe, expect, it } from "vitest";

import { hojeISO } from "../../src/base/datas";
import { chamar, criarFazenda } from "../ajuda";

const HOJE = hojeISO();

describe("estoque no Início (Fique de olho)", () => {
  it("traz o resumo do estoque só da própria organização", async () => {
    const f = await criarFazenda("Painel Estoque");
    const outra = await criarFazenda("Painel Estoque Outra");
    const base = `/api/org/${f.orgId}/estoque`;
    const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${base}/${caminho}`, corpo)).json;
    const racao = await post("produtos", { nome: "Ração", categoria: "racao", unidade: "kg", estoqueMinimo: 500 });
    const desinfetante = await post("produtos", { nome: "Desinfetante", categoria: "material", unidade: "l" });
    const deposito = await post("locais", { nome: "Depósito", tipo: "deposito" });
    await post("entradas", { data: HOJE, itens: [{ produtoId: racao.id, localId: deposito.id, quantidade: 100 }] });
    await post("movimentos/saida", { produtoId: desinfetante.id, localId: deposito.id, quantidade: 2, data: HOJE, confirmarNegativo: true });

    const r = await chamar(f.membro, "GET", `/api/org/${f.orgId}/inicio/avisos`);
    expect(r.status).toBe(200);
    expect(r.json).toEqual(
      expect.arrayContaining([
        { id: "estoque-negativos", texto: "1 produto com saldo negativo no estoque", tom: "danger", link: "/estoque" },
        { id: "estoque-abaixoMinimo", texto: "1 produto abaixo do mínimo no estoque", tom: "warn", link: "/estoque" },
      ]),
    );

    const daOutra = await chamar(outra.dono, "GET", `/api/org/${outra.orgId}/inicio/avisos`);
    expect(daOutra.json.filter((a: { id: string }) => a.id.startsWith("estoque-"))).toEqual([]);
    expect((await chamar(outra.dono, "GET", `/api/org/${f.orgId}/inicio/avisos`)).status).toBe(403);
  });
});
