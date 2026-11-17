import { beforeAll, describe, expect, it } from "vitest";

import { chamar, criarFazenda } from "../ajuda";

let f: Awaited<ReturnType<typeof criarFazenda>>;
const rota = () => `/api/org/${f.orgId}/animais`;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
});

describe("animais", () => {
  it("membro cadastra, e o peso volta como número", async () => {
    const criado = await chamar(f.membro, "POST", rota(), { numero: "32", nome: "Mimosa", especie: "bovino", pesoKg: 480 });
    expect(criado.status).toBe(201);

    const lista = await chamar(f.membro, "GET", rota());
    expect(lista.json).toEqual([expect.objectContaining({ id: criado.json.id, numero: "32", nome: "Mimosa", pesoKg: 480, status: "ativo" })]);
  });

  it("recusa cadastro sem nome nem número, com a mensagem do contrato", async () => {
    const r = await chamar(f.membro, "POST", rota(), { especie: "bovino" });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Informe o nome ou o número do animal.");
  });

  it("membro edita, mas não remove", async () => {
    const { json } = await chamar(f.membro, "POST", rota(), { nome: "Thor", especie: "cao" });

    const editado = await chamar(f.membro, "PATCH", `${rota()}/${json.id}`, { nome: "Thor", especie: "cao", raca: "Labrador", status: "ativo" });
    expect(editado.status).toBe(200);

    const removido = await chamar(f.membro, "DELETE", `${rota()}/${json.id}`);
    expect(removido.status).toBe(403);
  });

  it("administrador remove", async () => {
    const { json } = await chamar(f.membro, "POST", rota(), { nome: "Bolota", especie: "ovino" });
    expect((await chamar(f.admin, "DELETE", `${rota()}/${json.id}`)).status).toBe(200);

    const lista = await chamar(f.admin, "GET", rota());
    expect(lista.json.map((a: { nome: string }) => a.nome)).not.toContain("Bolota");
  });
});

describe("mãe e pai", () => {
  it("membro liga a cria à mãe e ao pai, e a ficha mostra a família", async () => {
    const mae = (await chamar(f.membro, "POST", rota(), { nome: "Porca 7", especie: "suino", sexo: "femea" })).json.id;
    const pai = (await chamar(f.membro, "POST", rota(), { numero: "12", nome: "Cachaço", especie: "suino", sexo: "macho" })).json.id;
    const cria = await chamar(f.membro, "POST", rota(), { nome: "Cria 1", especie: "suino", nascimento: "2026-11-15", maeId: mae, paiId: pai });
    expect(cria.status).toBe(201);
    const irma = (await chamar(f.membro, "POST", rota(), { nome: "Cria 2", especie: "suino", nascimento: "2026-11-16", maeId: mae, paiExterno: "sêmen Duroc" })).json.id;

    const fichaCria = (await chamar(f.membro, "GET", `${rota()}/${cria.json.id}/ficha`)).json;
    expect(fichaCria.mae).toMatchObject({ id: mae, rotulo: "Porca 7" });
    expect(fichaCria.pai).toMatchObject({ id: pai, rotulo: "nº 12 Cachaço" });
    expect(fichaCria.animal).toMatchObject({ maeId: mae, paiId: pai, paiExterno: null });

    const fichaMae = (await chamar(f.membro, "GET", `${rota()}/${mae}/ficha`)).json;
    expect(fichaMae.mae).toBeNull();
    // Do mais novo para o mais velho.
    expect(fichaMae.filhos.map((x: { id: string }) => x.id)).toEqual([irma, cria.json.id]);
    const fichaIrma = (await chamar(f.membro, "GET", `${rota()}/${irma}/ficha`)).json;
    expect(fichaIrma).toMatchObject({ pai: null, animal: { paiExterno: "sêmen Duroc" } });

    // Tirar a mãe na edição desfaz o vínculo.
    await chamar(f.membro, "PATCH", `${rota()}/${irma}`, { nome: "Cria 2", especie: "suino", status: "ativo", paiExterno: "sêmen Duroc" });
    expect((await chamar(f.membro, "GET", `${rota()}/${mae}/ficha`)).json.filhos).toHaveLength(1);
  });

  it("não aceita mãe ou pai de outra fazenda, nem o próprio animal", async () => {
    const vizinha = await criarFazenda("Boa Vista");
    const alheia = (await chamar(vizinha.dono, "POST", `/api/org/${vizinha.orgId}/animais`, { nome: "Alheia", especie: "suino" })).json.id;
    const r = await chamar(f.membro, "POST", rota(), { nome: "Cria 3", especie: "suino", maeId: alheia });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Mãe ou pai não encontrado nesta organização.");

    const { json } = await chamar(f.membro, "POST", rota(), { nome: "Solo", especie: "suino" });
    const propria = await chamar(f.membro, "PATCH", `${rota()}/${json.id}`, { nome: "Solo", especie: "suino", status: "ativo", maeId: json.id });
    expect(propria.status).toBe(400);
    expect(propria.json.error).toBe("O animal não pode ser mãe ou pai de si mesmo.");

    // E a vizinha não lê a família dos nossos.
    expect((await chamar(vizinha.dono, "GET", `${rota()}/${json.id}/ficha`)).status).toBe(403);
  });
});
