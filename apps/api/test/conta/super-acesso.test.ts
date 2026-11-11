import { beforeAll, describe, expect, it } from "vitest";

import { chamar, criarFazenda, criarSuper, type Pessoa } from "../ajuda";

type Fazenda = Awaited<ReturnType<typeof criarFazenda>>;

let f: Fazenda;
let outra: Fazenda;
let sup: Pessoa;

beforeAll(async () => {
  f = await criarFazenda("Granja Teste");
  outra = await criarFazenda("Vizinha");
  sup = await criarSuper();
});

describe("super usuário em empresa onde não está vinculado", () => {
  it("lê e grava como dono", async () => {
    expect((await chamar(sup, "GET", `/api/org/${f.orgId}/animais`)).status).toBe(200);
    const novo = await chamar(sup, "POST", `/api/org/${f.orgId}/animais`, { numero: "7", nome: "Pintada", especie: "bovino" });
    expect(novo.status).toBe(201);
  });

  it("o papel dele lá é dono; o de cada membro, o dele", async () => {
    expect((await chamar(sup, "GET", `/api/org/${f.orgId}/meu-papel`)).json).toEqual({ role: "owner" });
    expect((await chamar(f.membro, "GET", `/api/org/${f.orgId}/meu-papel`)).json).toEqual({ role: "member" });
    expect((await chamar(outra.dono, "GET", `/api/org/${f.orgId}/meu-papel`)).status).toBe(403);
  });

  it("gerencia os usuários da empresa: muda papel e remove", async () => {
    const usuarios = `/api/org/${f.orgId}/usuarios`;
    expect((await chamar(sup, "PATCH", `${usuarios}/${f.membro.id}`, { role: "admin" })).status).toBe(200);
    const lista = await chamar(sup, "GET", usuarios);
    expect(lista.json.find((u: { id: string }) => u.id === f.membro.id).role).toBe("admin");
    expect((await chamar(sup, "DELETE", `${usuarios}/${f.membro.id}`)).status).toBe(200);
    expect((await chamar(f.membro, "GET", `/api/org/${f.orgId}/animais`)).status).toBe(403);
  });

  it("dono de outra empresa continua sem acesso", async () => {
    expect((await chamar(outra.dono, "GET", `/api/org/${f.orgId}/animais`)).status).toBe(403);
  });
});

describe("empresa ativa e lista de empresas do super", () => {
  it("super troca a empresa ativa para qualquer uma; comum não usa essa rota", async () => {
    const r = await chamar(sup, "POST", "/api/admin/empresa-ativa", { organizationId: f.orgId });
    expect(r.status).toBe(200);
    expect((await chamar(sup, "GET", "/api/auth/get-session")).json.session.activeOrganizationId).toBe(f.orgId);

    expect((await chamar(f.dono, "POST", "/api/admin/empresa-ativa", { organizationId: outra.orgId })).status).toBe(403);
    expect((await chamar(sup, "POST", "/api/admin/empresa-ativa", { organizationId: "nao-existe" })).status).toBe(404);
  });

  it("super recebe todas as empresas no formato do seletor; comum recebe 403", async () => {
    const r = await chamar(sup, "GET", "/api/admin/organizacoes");
    expect(r.status).toBe(200);
    expect(r.json).toEqual(expect.arrayContaining([expect.objectContaining({ id: f.orgId, name: "Granja Teste", slug: "granjateste" })]));
    expect((await chamar(f.dono, "GET", "/api/admin/organizacoes")).status).toBe(403);
  });
});
