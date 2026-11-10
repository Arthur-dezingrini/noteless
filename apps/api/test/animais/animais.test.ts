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
