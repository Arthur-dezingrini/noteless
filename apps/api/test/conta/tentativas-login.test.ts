import { beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { esperaParaEntrar, JANELA_MS, MAXIMO_FALHAS, registrarFalha } from "../../src/modulos/conta/regras/tentativas-login";
import { criarFazenda, entrar } from "../ajuda";

let f: Awaited<ReturnType<typeof criarFazenda>>;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
});

/** Tenta entrar como o navegador; devolve status, corpo e Retry-After. */
async function tentar(email: string, senha: string) {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password: senha }),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as { message?: string } | null, retryAfter: res.headers.get("retry-after") };
}

async function errar(email: string, vezes: number) {
  for (let i = 0; i < vezes; i++) expect((await tentar(email, "senha-errada")).status).toBe(401);
}

describe("tentativas erradas de login", () => {
  it(`depois de ${MAXIMO_FALHAS} erros o e-mail fica bloqueado, até com a senha certa; os outros entram`, async () => {
    await errar(f.membro.email, MAXIMO_FALHAS);

    const bloqueado = await tentar(f.membro.email, "senha-de-teste-123");
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.json?.message).toMatch(/Muitas tentativas erradas com este e-mail\. Tente de novo em 15 minutos\./);
    expect(Number(bloqueado.retryAfter)).toBeGreaterThan(0);
    expect(Number(bloqueado.retryAfter)).toBeLessThanOrEqual(JANELA_MS / 1000);

    // Maiúscula e espaço não escapam do bloqueio.
    expect((await tentar(` ${f.membro.email.toUpperCase()} `, "senha-de-teste-123")).status).toBe(429);

    await expect(entrar(f.admin.email)).resolves.toContain("=");
  });

  it("e-mail que não existe bloqueia igual — a resposta não entrega quais contas existem", async () => {
    await errar("ninguem@santarita.test", MAXIMO_FALHAS);
    expect((await tentar("ninguem@santarita.test", "qualquer")).status).toBe(429);
  });

  it("entrar com a senha certa zera os erros", async () => {
    await errar(f.dono.email, MAXIMO_FALHAS - 1);
    await entrar(f.dono.email);
    await errar(f.dono.email, MAXIMO_FALHAS - 1);
    await expect(entrar(f.dono.email)).resolves.toContain("=");
  });

  it("o bloqueio vence com a janela, e a contagem recomeça", async () => {
    const email = "janela@santarita.test";
    const t0 = new Date("2026-11-16T12:00:00Z");
    for (let i = 0; i < MAXIMO_FALHAS; i++) await registrarFalha(email, t0);
    expect(await esperaParaEntrar(email, t0)).toBe(JANELA_MS / 1000);

    const depois = new Date(t0.getTime() + JANELA_MS + 1000);
    expect(await esperaParaEntrar(email, depois)).toBeNull();
    await registrarFalha(email, depois);
    expect(await esperaParaEntrar(email, depois)).toBeNull();
  });

  it("falhas ao mesmo tempo contam todas (instâncias diferentes não se atropelam)", async () => {
    const email = "simultaneo@santarita.test";
    await Promise.all(Array.from({ length: MAXIMO_FALHAS }, () => registrarFalha(email)));
    expect(await esperaParaEntrar(email)).not.toBeNull();
  });
});
