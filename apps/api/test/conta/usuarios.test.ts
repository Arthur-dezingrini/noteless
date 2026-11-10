import { beforeAll, describe, expect, it } from "vitest";

import { auth } from "../../src/auth";
import { chamar, criarFazenda, entrar, type Pessoa } from "../ajuda";

type Fazenda = Awaited<ReturnType<typeof criarFazenda>>;

let santaRita: Fazenda;
let boaVista: Fazenda;

beforeAll(async () => {
  santaRita = await criarFazenda("Santa Rita");
  boaVista = await criarFazenda("Boa Vista");
});

const SENHA = "senha-inicial-123";
const NOVA = "senha-nova-456";
const trocarSenha = { password: NOVA, confirmPassword: NOVA };
const COMPARTILHADA = "Essa pessoa também participa de outra organização; só ela pode trocar a senha e o e-mail.";
const DO_DONO = "Senha e e-mail do dono da organização só podem ser trocados pelo próprio dono.";

const usuarios = (f: Fazenda) => `/api/org/${f.orgId}/usuarios`;

let n = 0;
/** Alguém cadastrado pela tela de usuários, só nesta fazenda, já logado. */
async function cadastrar(f: Fazenda, role: "admin" | "member" = "member"): Promise<Pessoa> {
  const email = `pessoa${++n}@cadastro.test`;
  const r = await chamar(f.admin, "POST", usuarios(f), { name: `Pessoa ${n}`, email, role, password: SENHA, confirmPassword: SENHA });
  expect(r.status).toBe(201);
  return { id: r.json.id, email, cookie: await entrar(email, SENHA) };
}

/** Alguém da Boa Vista que a Santa Rita também vinculou. */
async function compartilhada(): Promise<Pessoa> {
  const p = await cadastrar(boaVista);
  const r = await chamar(santaRita.admin, "POST", `${usuarios(santaRita)}/vincular`, { email: p.email, role: "member" });
  expect(r.status).toBe(201);
  return p;
}

/** Sessão ainda vale? */
async function logado(p: Pessoa, f: Fazenda) {
  return (await chamar(p, "GET", `/api/org/${f.orgId}/animais`)).status === 200;
}

describe("administrador troca senha e e-mail de quem só está na fazenda dele", () => {
  it("dono e administrador definem senha nova; a antiga para de valer", async () => {
    for (const quem of [santaRita.dono, santaRita.admin]) {
      const p = await cadastrar(santaRita);
      const r = await chamar(quem, "PATCH", `${usuarios(santaRita)}/${p.id}`, trocarSenha);
      expect(r.status).toBe(200);
      await expect(entrar(p.email, SENHA)).rejects.toThrow(/login falhou \(401\)/);
      await entrar(p.email, NOVA);
    }
  });

  it("senha nova derruba as sessões que a pessoa tinha abertas", async () => {
    const p = await cadastrar(santaRita);
    expect(await logado(p, santaRita)).toBe(true);

    await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${p.id}`, trocarSenha);
    expect(await logado(p, santaRita)).toBe(false);
  });

  it("troca o e-mail", async () => {
    const p = await cadastrar(santaRita);
    const novo = `nova-${p.email}`;
    const r = await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${p.id}`, { email: novo });
    expect(r.status).toBe(200);
    await entrar(novo, SENHA);
  });

  it("a própria senha: esta sessão continua, as dos outros aparelhos caem", async () => {
    const eu = await cadastrar(santaRita, "admin");
    const outroAparelho = { ...eu, cookie: await entrar(eu.email, SENHA) };

    const r = await chamar(eu, "PATCH", `${usuarios(santaRita)}/${eu.id}`, trocarSenha);
    expect(r.status).toBe(200);
    expect(await logado(eu, santaRita)).toBe(true);
    expect(await logado(outroAparelho, santaRita)).toBe(false);
    await entrar(eu.email, NOVA);
  });

  it("o dono troca a própria senha", async () => {
    const f = await criarFazenda("Três Marias");
    const r = await chamar(f.dono, "PATCH", `${usuarios(f)}/${f.dono.id}`, trocarSenha);
    expect(r.status).toBe(200);
    await entrar(f.dono.email, NOVA);
  });
});

describe("o que ninguém troca pela conta dos outros", () => {
  it("tomada de conta: vincular o dono de outra fazenda e trocar a senha dele", async () => {
    // Basta saber o e-mail. Vincular continua valendo — é assim que um
    // veterinário atende várias fazendas —, mas a senha não é mais da Santa Rita.
    const vinculo = await chamar(santaRita.admin, "POST", `${usuarios(santaRita)}/vincular`, { email: boaVista.dono.email, role: "member" });
    expect(vinculo.status).toBe(201);

    const r = await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${boaVista.dono.id}`, { name: "Invasor", ...trocarSenha });
    expect(r.status).toBe(403);
    expect(r.json.error).toBe(COMPARTILHADA);

    await expect(entrar(boaVista.dono.email, NOVA)).rejects.toThrow(/login falhou \(401\)/);
    expect(await logado(boaVista.dono, boaVista)).toBe(true);
    // Recusou tudo, não só a senha: o nome que veio junto também ficou.
    const lista = await chamar(boaVista.dono, "GET", usuarios(boaVista));
    expect(lista.json.find((u: { id: string }) => u.id === boaVista.dono.id).name).toBe("Dono");
  });

  it("e-mail de quem também está em outra fazenda", async () => {
    const p = await compartilhada();
    const r = await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${p.id}`, { email: "invasor@fora.test" });
    expect(r.status).toBe(403);
    expect(r.json.error).toBe(COMPARTILHADA);
    await entrar(p.email, SENHA);
  });

  it("de quem também está em outra fazenda, papel, nome e cargo continuam editáveis", async () => {
    // A tela manda o e-mail de volta mesmo sem mudar: isso não pode contar como troca.
    const p = await compartilhada();
    const r = await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${p.id}`, {
      name: "Pessoa Vinculada",
      email: p.email.toUpperCase(),
      cargo: "Veterinária",
      role: "admin",
    });
    expect(r.status).toBe(200);

    const lista = await chamar(santaRita.admin, "GET", usuarios(santaRita));
    expect(lista.json.find((u: { id: string }) => u.id === p.id)).toMatchObject({
      name: "Pessoa Vinculada",
      email: p.email,
      cargo: "Veterinária",
      role: "admin",
    });
  });

  it("administrador não troca senha nem e-mail do dono da organização", async () => {
    for (const corpo of [trocarSenha, { email: "invasor@fora.test" }]) {
      const r = await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${santaRita.dono.id}`, corpo);
      expect(r.status).toBe(403);
      expect(r.json.error).toBe(DO_DONO);
    }
    await entrar(santaRita.dono.email);
  });

  it("quem tem \"owner\" junto com outro papel conta como dono", async () => {
    // O dono consegue dar os dois papéis a alguém direto pela api do Better Auth.
    const p = await cadastrar(santaRita, "admin");
    const lista = await chamar(santaRita.dono, "GET", usuarios(santaRita));
    const memberId = lista.json.find((u: { id: string }) => u.id === p.id).memberId;
    const papel = await chamar(santaRita.dono, "POST", "/api/auth/organization/update-member-role", {
      memberId,
      role: ["admin", "owner"],
      organizationId: santaRita.orgId,
    });
    expect(papel.status).toBe(200);

    const r = await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${p.id}`, trocarSenha);
    expect(r.status).toBe(403);
    expect(r.json.error).toBe(DO_DONO);
    expect((await chamar(santaRita.admin, "PATCH", `${usuarios(santaRita)}/${p.id}`, { role: "member" })).status).toBe(400);
    expect((await chamar(santaRita.admin, "DELETE", `${usuarios(santaRita)}/${p.id}`)).status).toBe(400);
  });

  it("membro não troca a senha de ninguém", async () => {
    const p = await cadastrar(santaRita);
    const r = await chamar(santaRita.membro, "PATCH", `${usuarios(santaRita)}/${p.id}`, trocarSenha);
    expect(r.status).toBe(403);
    expect(r.json.error).toBe("Só administradores podem editar usuários.");
    await entrar(p.email, SENHA);
  });

  it("administrador de outra fazenda não alcança quem não está nela", async () => {
    const p = await cadastrar(santaRita);
    const pelaDele = await chamar(boaVista.admin, "PATCH", `${usuarios(boaVista)}/${p.id}`, trocarSenha);
    expect(pelaDele.status).toBe(404);
    const pelaOutra = await chamar(boaVista.admin, "PATCH", `${usuarios(santaRita)}/${p.id}`, trocarSenha);
    expect(pelaOutra.status).toBe(403);
    await entrar(p.email, SENHA);
  });
});

describe("criar organização", () => {
  it("ninguém cria pela api — senão qualquer um vira dono e vincula quem quiser", async () => {
    for (const p of [santaRita.membro, santaRita.admin, santaRita.dono]) {
      const r = await chamar(p, "POST", "/api/auth/organization/create", { name: "Fazenda Nova", slug: `nova-${p.id}` });
      expect(r.status).toBe(403);
    }
  });

  it("o servidor ainda cria (seed)", async () => {
    const p = await cadastrar(santaRita);
    const org = await auth.api.createOrganization({ body: { name: "Fazenda do Seed", slug: "fazenda-do-seed", userId: p.id } });
    expect(org?.id).toBeTruthy();
  });
});
