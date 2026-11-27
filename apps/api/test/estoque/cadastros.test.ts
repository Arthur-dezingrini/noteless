import { describe, expect, it } from "vitest";

import { chamar, criarFazenda } from "../ajuda";

describe("cadastros do estoque", () => {
  it("dono, admin e membro cadastram e listam; outra fazenda leva 403", async () => {
    const f = await criarFazenda("Cadastro Estoque");
    const outra = await criarFazenda("Cadastro Estoque Fora");
    const base = `/api/org/${f.orgId}/estoque`;

    const vacina = await chamar(f.membro, "POST", `${base}/produtos`, { nome: "Newcastle", categoria: "vacina", unidade: "dose" });
    expect(vacina.status).toBe(201);
    expect(vacina.json).toMatchObject({ nome: "Newcastle", categoria: "vacina", unidade: "dose", controlaLote: true, ativo: true, custoMedio: 0 });

    const racao = await chamar(f.admin, "POST", `${base}/produtos`, {
      nome: "Ração postura",
      categoria: "racao",
      unidade: "kg",
      embalagemNome: "saco",
      embalagemFator: 25,
      estoqueMinimo: 1000,
    });
    expect(racao.status).toBe(201);
    expect(racao.json).toMatchObject({ controlaLote: false, embalagemFator: 25, estoqueMinimo: 1000 });

    const lista = await chamar(f.dono, "GET", `${base}/produtos`);
    expect(lista.status).toBe(200);
    expect(lista.json.map((p: { nome: string }) => p.nome).sort()).toEqual(["Newcastle", "Ração postura"]);

    const deposito = await chamar(f.membro, "POST", `${base}/locais`, { nome: "Depósito", tipo: "deposito" });
    expect(deposito.status).toBe(201);
    expect(deposito.json).toMatchObject({ nome: "Depósito", tipo: "deposito", instalacaoId: null, instalacaoNome: null, ativo: true });

    const forn = await chamar(f.membro, "POST", `${base}/fornecedores`, { nome: "Agro X", documento: "12.345.678/0001-99" });
    expect(forn.status).toBe(201);
    expect(forn.json).toMatchObject({ nome: "Agro X", documento: "12345678000199", telefone: null });

    for (const recurso of ["produtos", "locais", "fornecedores"]) {
      expect((await chamar(outra.dono, "GET", `${base}/${recurso}`)).status).toBe(403);
      expect((await chamar(outra.dono, "POST", `${base}/${recurso}`, { nome: "Intruso", tipo: "outro", categoria: "outro", unidade: "un" })).status).toBe(403);
    }
    expect((await chamar(null, "GET", `${base}/produtos`)).status).toBe(403);
    expect((await chamar(outra.dono, "PATCH", `/api/org/${outra.orgId}/estoque/produtos/${vacina.json.id}`, { nome: "Roubada" })).status).toBe(404);
  });

  it("nome repetido e documento repetido dão 409", async () => {
    const f = await criarFazenda("Repetido Estoque");
    const base = `/api/org/${f.orgId}/estoque`;
    await chamar(f.dono, "POST", `${base}/produtos`, { nome: "Milho", categoria: "racao", unidade: "kg" });
    const p = await chamar(f.dono, "POST", `${base}/produtos`, { nome: "Milho", categoria: "racao", unidade: "kg" });
    expect(p).toMatchObject({ status: 409, json: { error: "Já existe um produto com esse nome." } });

    await chamar(f.dono, "POST", `${base}/locais`, { nome: "Depósito", tipo: "deposito" });
    const l = await chamar(f.dono, "POST", `${base}/locais`, { nome: "Depósito", tipo: "deposito" });
    expect(l).toMatchObject({ status: 409, json: { error: "Já existe um local com esse nome." } });

    await chamar(f.dono, "POST", `${base}/fornecedores`, { nome: "A", documento: "12345678901" });
    const fo = await chamar(f.dono, "POST", `${base}/fornecedores`, { nome: "B", documento: "123.456.789-01" });
    expect(fo).toMatchObject({ status: 409, json: { error: "Já existe um fornecedor com esse documento." } });
  });

  it("silo ligado ao galpão; segundo silo ativo 409; galpão de outra fazenda 404", async () => {
    const f = await criarFazenda("Silo Estoque");
    const outra = await criarFazenda("Silo Estoque Fora");
    const galpao = await chamar(f.dono, "POST", `/api/org/${f.orgId}/instalacoes`, { nome: "Galpão 1", tipo: "galpao" });
    const alheio = await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/instalacoes`, { nome: "Galpão X", tipo: "galpao" });
    const base = `/api/org/${f.orgId}/estoque/locais`;

    const silo = await chamar(f.dono, "POST", base, { nome: "Silo 1", tipo: "silo", instalacaoId: galpao.json.id });
    expect(silo.status).toBe(201);
    expect(silo.json).toMatchObject({ instalacaoId: galpao.json.id, instalacaoNome: "Galpão 1" });

    const segundo = await chamar(f.dono, "POST", base, { nome: "Silo 2", tipo: "silo", instalacaoId: galpao.json.id });
    expect(segundo).toMatchObject({ status: 409, json: { error: "Este galpão já tem um silo ativo." } });

    const deFora = await chamar(f.dono, "POST", base, { nome: "Silo 3", tipo: "silo", instalacaoId: alheio.json.id });
    expect(deFora).toMatchObject({ status: 404, json: { error: "Galpão não encontrado." } });

    // Desativado o primeiro, o galpão aceita outro silo.
    await chamar(f.dono, "PATCH", `${base}/${silo.json.id}`, { ativo: false });
    expect((await chamar(f.dono, "POST", base, { nome: "Silo 2", tipo: "silo", instalacaoId: galpao.json.id })).status).toBe(201);
  });

  it("desativar e editar produto, local e fornecedor", async () => {
    const f = await criarFazenda("Editar Estoque");
    const base = `/api/org/${f.orgId}/estoque`;
    const p = await chamar(f.dono, "POST", `${base}/produtos`, { nome: "Iodo", categoria: "medicamento", unidade: "ml" });
    const editado = await chamar(f.membro, "PATCH", `${base}/produtos/${p.json.id}`, { ativo: false, estoqueMinimo: 500 });
    expect(editado).toMatchObject({ status: 200, json: { ativo: false, estoqueMinimo: 500, controlaLote: true } });

    const l = await chamar(f.dono, "POST", `${base}/locais`, { nome: "Farmácia", tipo: "farmacia" });
    expect((await chamar(f.dono, "PATCH", `${base}/locais/${l.json.id}`, { nome: "Farmácia central" })).json).toMatchObject({ nome: "Farmácia central" });

    const fo = await chamar(f.dono, "POST", `${base}/fornecedores`, { nome: "Vet Y" });
    expect((await chamar(f.dono, "PATCH", `${base}/fornecedores/${fo.json.id}`, { telefone: "16 99999-0000" })).json).toMatchObject({
      nome: "Vet Y",
      telefone: "16 99999-0000",
    });

    expect((await chamar(f.dono, "PATCH", `${base}/produtos/nao-existe`, { nome: "X" })).status).toBe(404);
  });
});
