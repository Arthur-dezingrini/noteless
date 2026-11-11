import { beforeAll, describe, expect, it } from "vitest";

import { chamar, criarFazenda, criarSuper, type Pessoa } from "../ajuda";

type Fazenda = Awaited<ReturnType<typeof criarFazenda>>;

const SO_SUPER = "Só o super usuário mexe nos vínculos.";
const SEM_DONO = "A empresa ficaria sem dono.";
const ULTIMO_SUPER = "Precisa sobrar pelo menos um super usuário.";

let a: Fazenda;
let b: Fazenda;
let sup: Pessoa;

beforeAll(async () => {
  a = await criarFazenda("Água Limpa");
  b = await criarFazenda("Bela Vista");
  sup = await criarSuper();
});

const empresasDe = async (p: Pessoa) =>
  ((await chamar(p, "GET", "/api/auth/organization/list")).json as { id: string }[]).map((o) => o.id);
const usuarioAdmin = async (email: string) =>
  ((await chamar(sup, "GET", `/api/admin/usuarios?busca=${encodeURIComponent(email)}`)).json as { id: string; email: string; vinculos: { memberId: string; organizationId: string; papel: string }[] }[]).find(
    (u) => u.email === email,
  )!;

describe("quem entra em /api/admin", () => {
  it("sem login 401; dono e membro de empresa 403; super 200", async () => {
    expect((await chamar(null, "GET", "/api/admin/usuarios")).status).toBe(401);
    for (const quem of [a.dono, a.membro]) {
      const r = await chamar(quem, "GET", "/api/admin/usuarios");
      expect(r.status).toBe(403);
      expect(r.json.error).toBe(SO_SUPER);
    }
    for (const rota of ["/api/admin/empresas", `/api/admin/vinculos`]) {
      const r = await chamar(a.dono, rota.endsWith("vinculos") ? "POST" : "GET", rota, rota.endsWith("vinculos") ? { userId: a.dono.id, organizationId: b.orgId, papel: "member" } : undefined);
      expect(r.status, rota).toBe(403);
    }
    expect((await chamar(sup, "GET", "/api/admin/usuarios")).status).toBe(200);
  });

  it("lista usuários com os vínculos e busca por e-mail sem diferença de maiúscula", async () => {
    const r = await chamar(sup, "GET", `/api/admin/usuarios?busca=${encodeURIComponent(a.admin.email.toUpperCase())}`);
    expect(r.status).toBe(200);
    expect(r.json).toHaveLength(1);
    expect(r.json[0]).toMatchObject({ email: a.admin.email, tipo: "comum", vinculos: [{ organizationId: a.orgId, empresa: "Água Limpa", papel: "admin" }] });
  });

  it("lista todas as empresas", async () => {
    const r = await chamar(sup, "GET", "/api/admin/empresas");
    expect(r.json.map((e: { id: string }) => e.id)).toEqual(expect.arrayContaining([a.orgId, b.orgId]));
  });
});

describe("vincular, mudar papel e desvincular", () => {
  it("vincula qualquer usuário a qualquer empresa; duas vezes é 409", async () => {
    const r = await chamar(sup, "POST", "/api/admin/vinculos", { userId: a.membro.id, organizationId: b.orgId, papel: "member" });
    expect(r.status).toBe(201);
    expect(await empresasDe(a.membro)).toContain(b.orgId);

    const de_novo = await chamar(sup, "POST", "/api/admin/vinculos", { userId: a.membro.id, organizationId: b.orgId, papel: "admin" });
    expect(de_novo.status).toBe(409);
    expect(de_novo.json.error).toBe("Essa pessoa já está nessa empresa.");
  });

  it("empresa ou usuário que não existe é 404", async () => {
    const e = await chamar(sup, "POST", "/api/admin/vinculos", { userId: a.membro.id, organizationId: "nao-existe", papel: "member" });
    expect(e.status).toBe(404);
    expect(e.json.error).toBe("Empresa não encontrada.");
    const u = await chamar(sup, "POST", "/api/admin/vinculos", { userId: "nao-existe", organizationId: a.orgId, papel: "member" });
    expect(u.status).toBe(404);
    expect(u.json.error).toBe("Usuário não encontrado.");
  });

  it("muda o papel; rebaixar o único dono é 422", async () => {
    const membro = (await usuarioAdmin(a.membro.email)).vinculos.find((v) => v.organizationId === a.orgId)!;
    expect((await chamar(sup, "PATCH", `/api/admin/vinculos/${membro.memberId}`, { papel: "admin" })).status).toBe(200);
    expect((await usuarioAdmin(a.membro.email)).vinculos.find((v) => v.organizationId === a.orgId)!.papel).toBe("admin");

    const dono = (await usuarioAdmin(a.dono.email)).vinculos.find((v) => v.organizationId === a.orgId)!;
    const r = await chamar(sup, "PATCH", `/api/admin/vinculos/${dono.memberId}`, { papel: "member" });
    expect(r.status).toBe(422);
    expect(r.json.error).toBe(SEM_DONO);
  });

  it("desvincula; o único dono não sai", async () => {
    const v = (await usuarioAdmin(a.membro.email)).vinculos.find((x) => x.organizationId === b.orgId)!;
    expect((await chamar(sup, "DELETE", `/api/admin/vinculos/${v.memberId}`)).status).toBe(200);
    expect(await empresasDe(a.membro)).not.toContain(b.orgId);

    const dono = (await usuarioAdmin(b.dono.email)).vinculos.find((x) => x.organizationId === b.orgId)!;
    const r = await chamar(sup, "DELETE", `/api/admin/vinculos/${dono.memberId}`);
    expect(r.status).toBe(422);
    expect(r.json.error).toBe(SEM_DONO);
    expect(await empresasDe(b.dono)).toContain(b.orgId);
    expect((await chamar(sup, "DELETE", "/api/admin/vinculos/nao-existe")).json.error).toBe("Vínculo não encontrado.");
  });
});

describe("tipo de usuário", () => {
  it("o único super não tira o próprio super; com dois, um tira o do outro", async () => {
    const f = await criarFazenda("Cedro");
    const sozinho = await chamar(sup, "PATCH", `/api/admin/usuarios/${sup.id}`, { tipo: "comum" });
    // Outros arquivos de teste não compartilham banco: aqui só existe `sup`.
    expect(sozinho.status).toBe(422);
    expect(sozinho.json.error).toBe(ULTIMO_SUPER);

    expect((await chamar(sup, "PATCH", `/api/admin/usuarios/${f.dono.id}`, { tipo: "super" })).status).toBe(200);
    expect((await chamar(f.dono, "GET", "/api/auth/get-session")).json.user.tipo).toBe("super");
    expect((await chamar(f.dono, "PATCH", `/api/admin/usuarios/${sup.id}`, { tipo: "comum" })).status).toBe(200);
    expect((await chamar(sup, "GET", "/api/admin/usuarios")).status).toBe(403);
  });
});

it("o vínculo por e-mail da empresa saiu", async () => {
  const r = await chamar(a.admin, "POST", `/api/org/${a.orgId}/usuarios/vincular`, { email: b.dono.email, role: "member" });
  expect(r.status).toBe(404);
});
