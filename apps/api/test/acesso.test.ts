import { beforeAll, describe, expect, it } from "vitest";

import { chamar, criarFazenda, entrar } from "./ajuda";

let santaRita: Awaited<ReturnType<typeof criarFazenda>>;
let boaVista: Awaited<ReturnType<typeof criarFazenda>>;

beforeAll(async () => {
  santaRita = await criarFazenda("Santa Rita");
  boaVista = await criarFazenda("Boa Vista");
});

describe("acesso às organizações", () => {
  it("sem login não entra", async () => {
    const r = await chamar(null, "GET", `/api/org/${santaRita.orgId}/animais`);
    expect(r.status).toBe(403);
  });

  it("senha errada não loga", async () => {
    await expect(entrar(santaRita.dono.email, "senha-errada")).rejects.toThrow(/login falhou \(401\)/);
  });

  it("todos os papéis da fazenda veem os animais dela", async () => {
    for (const p of [santaRita.dono, santaRita.admin, santaRita.membro]) {
      const r = await chamar(p, "GET", `/api/org/${santaRita.orgId}/animais`);
      expect(r.status).toBe(200);
    }
  });

  it("gente de outra fazenda não vê nada — nem o dono dela", async () => {
    for (const rota of ["animais", "consultas", "ocorrencias", "prontuarios", "grupos"]) {
      const r = await chamar(boaVista.dono, "GET", `/api/org/${santaRita.orgId}/${rota}`);
      expect(r.status, rota).toBe(403);
    }
  });

  it("não dá para ligar consulta ao animal de outra fazenda", async () => {
    const bicho = await chamar(boaVista.dono, "POST", `/api/org/${boaVista.orgId}/animais`, { nome: "Estrela", especie: "equino" });
    expect(bicho.status).toBe(201);

    const r = await chamar(santaRita.dono, "POST", `/api/org/${santaRita.orgId}/consultas`, {
      animalId: bicho.json.id,
      data: "2026-10-02",
      hora: "09:00",
      duracaoMin: 30,
      tipo: "consulta",
    });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Animal não encontrado nesta organização.");
  });
});
