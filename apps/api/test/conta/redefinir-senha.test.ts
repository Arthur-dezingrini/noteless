import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { enviarEmail } from "../../src/base/email";
import { esperaParaEntrar, MAXIMO_FALHAS, registrarFalha } from "../../src/modulos/conta/regras/tentativas-login";
import { chamar, criarFazenda, entrar } from "../ajuda";

vi.mock("../../src/base/email", () => ({ enviarEmail: vi.fn(async () => ({ enviado: true })) }));

const ORIGEM = "http://localhost:3000";
const TELA = `${ORIGEM}/redefinir-senha`;

let f: Awaited<ReturnType<typeof criarFazenda>>;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
});

beforeEach(() => vi.mocked(enviarEmail).mockClear());

function pedirLink(email: string, redirectTo = TELA) {
  return chamar(null, "POST", "/api/auth/request-password-reset", { email, redirectTo });
}

function trocarSenha(token: string, newPassword: string) {
  return chamar(null, "POST", "/api/auth/reset-password", { newPassword, token });
}

/** O token que foi no link do último e-mail enviado. */
function tokenDoEmail(): string {
  const email = vi.mocked(enviarEmail).mock.calls.at(-1)?.[0];
  const token = email?.texto.match(/\/reset-password\/([^?\s]+)/)?.[1];
  if (!token) throw new Error("nenhum link de redefinição no e-mail");
  return token;
}

describe("esqueci a senha", () => {
  it("manda o link para o e-mail da pessoa, com a tela de senha nova como destino", async () => {
    const res = await pedirLink(f.membro.email);

    expect(res.status).toBe(200);
    const [email] = vi.mocked(enviarEmail).mock.calls[0]!;
    expect(email.para).toEqual([f.membro.email]);
    expect(email.texto).toContain("/api/auth/reset-password/");
    expect(email.texto).toContain(encodeURIComponent(TELA));
  });

  it("e-mail que não existe recebe a mesma resposta, e nada é enviado", async () => {
    const existe = await pedirLink(f.admin.email);
    vi.mocked(enviarEmail).mockClear();

    const naoExiste = await pedirLink("ninguem@santarita.test");

    expect(naoExiste.status).toBe(existe.status);
    expect(naoExiste.json).toEqual(existe.json);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it("recusa destino fora das origens confiáveis: o link não leva para site de terceiro", async () => {
    const res = await pedirLink(f.membro.email, "https://site-falso.example/redefinir-senha");

    expect(res.status).toBe(403);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it("o link do e-mail abre a tela com o token; token inventado volta com erro", async () => {
    await pedirLink(f.membro.email);
    const token = tokenDoEmail();

    const bom = await app.request(`/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(TELA)}`);
    expect(bom.status).toBe(302);
    expect(bom.headers.get("location")).toContain(`/redefinir-senha?token=${token}`);

    const ruim = await app.request(`/api/auth/reset-password/token-inventado?callbackURL=${encodeURIComponent(TELA)}`);
    expect(ruim.headers.get("location")).toContain("error=INVALID_TOKEN");
  });

  it("troca a senha, derruba as sessões abertas e o mesmo link não serve duas vezes", async () => {
    await pedirLink(f.dono.email);
    const token = tokenDoEmail();

    expect((await trocarSenha(token, "senha-nova-456")).status).toBe(200);

    expect((await chamar(f.dono, "GET", "/api/auth/get-session")).json).toBeNull();
    await expect(entrar(f.dono.email)).rejects.toThrow(/401/);
    await expect(entrar(f.dono.email, "senha-nova-456")).resolves.toContain("=");
    expect((await trocarSenha(token, "outra-senha-789")).status).toBe(400);
  });

  it("senha nova curta demais é recusada", async () => {
    await pedirLink(f.admin.email);

    expect((await trocarSenha(tokenDoEmail(), "curta")).status).toBe(400);
    await expect(entrar(f.admin.email)).resolves.toContain("=");
  });

  it("redefinir a senha libera o e-mail travado por tentativas erradas", async () => {
    for (let i = 0; i < MAXIMO_FALHAS; i++) await registrarFalha(f.membro.email);
    expect(await esperaParaEntrar(f.membro.email)).not.toBeNull();

    await pedirLink(f.membro.email);
    expect((await trocarSenha(tokenDoEmail(), "senha-nova-321")).status).toBe(200);

    expect(await esperaParaEntrar(f.membro.email)).toBeNull();
    await expect(entrar(f.membro.email, "senha-nova-321")).resolves.toContain("=");
  });
});
