import { afterEach, describe, expect, it, vi } from "vitest";

/** Carrega env.ts do zero com estas variáveis. */
async function carregar(vars: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return import("../src/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("variáveis da api", () => {
  it("aceita login só do front", async () => {
    const { origensConfiaveis } = await carregar({ WEB_URL: "https://vocare-web.vercel.app" });
    expect(origensConfiaveis).toEqual(["https://vocare-web.vercel.app"]);
  });

  it("ORIGENS_EXTRAS libera mais endereços (domínio próprio, preview)", async () => {
    const { origensConfiaveis } = await carregar({
      WEB_URL: "https://vocare-web.vercel.app",
      ORIGENS_EXTRAS: " https://app.vocare.com.br , https://vocare-web-git-teste.vercel.app,",
    });
    expect(origensConfiaveis).toEqual([
      "https://vocare-web.vercel.app",
      "https://app.vocare.com.br",
      "https://vocare-web-git-teste.vercel.app",
    ]);
  });

  it("na Vercel não inventa a URL do front: sem WEB_URL a api não sobe e diz o que falta", async () => {
    const erros: string[] = [];
    vi.spyOn(console, "error").mockImplementation((m: string) => void erros.push(m));
    vi.spyOn(process, "exit").mockImplementation(((codigo: number) => {
      throw new Error(`exit ${codigo}`);
    }) as never);

    await expect(
      carregar({ VERCEL: "1", VERCEL_URL: "vocare-api-abc.vercel.app", WEB_URL: "", BETTER_AUTH_URL: "" }),
    ).rejects.toThrow("exit 1");
    expect(erros.join("\n")).toMatch(/WEB_URL/);
    expect(erros.join("\n")).toMatch(/BETTER_AUTH_URL/);
  });

  it("ORIGENS_EXTRAS com algo que não é URL também não sobe", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(((codigo: number) => {
      throw new Error(`exit ${codigo}`);
    }) as never);
    await expect(carregar({ ORIGENS_EXTRAS: "vocare.com.br" })).rejects.toThrow("exit 1");
  });
});
