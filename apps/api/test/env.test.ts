import { afterEach, describe, expect, it, vi } from "vitest";

/** Carrega env.ts do zero com as variáveis que a Vercel injetaria. */
async function carregar(vars: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return import("../src/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("endereço público na Vercel", () => {
  const vercel = {
    VERCEL_PROJECT_PRODUCTION_URL: "vocare.vercel.app",
    VERCEL_BRANCH_URL: "vocare-git-nova-tela-taiplan.vercel.app",
    VERCEL_URL: "vocare-abc123-taiplan.vercel.app",
    // Sem valor definido no painel: vem da Vercel.
    BETTER_AUTH_URL: "",
    WEB_URL: "",
  };

  it("produção usa o domínio do projeto", async () => {
    const { env } = await carregar({ ...vercel, VERCEL_ENV: "production" });
    expect(env.BETTER_AUTH_URL).toBe("https://vocare.vercel.app");
    expect(env.WEB_URL).toBe("https://vocare.vercel.app");
  });

  it("preview usa o endereço da branch e aceita login de qualquer endereço do deploy", async () => {
    const { env, origensConfiaveis } = await carregar({ ...vercel, VERCEL_ENV: "preview" });
    expect(env.WEB_URL).toBe("https://vocare-git-nova-tela-taiplan.vercel.app");
    expect(origensConfiaveis).toEqual([
      "https://vocare-git-nova-tela-taiplan.vercel.app",
      "https://vocare.vercel.app",
      "https://vocare-abc123-taiplan.vercel.app",
    ]);
  });

  it("URL definida no painel (domínio próprio) vence", async () => {
    const { env, origensConfiaveis } = await carregar({
      ...vercel,
      VERCEL_ENV: "production",
      BETTER_AUTH_URL: "https://app.vocare.com.br",
      WEB_URL: "https://app.vocare.com.br",
    });
    expect(env.WEB_URL).toBe("https://app.vocare.com.br");
    expect(origensConfiaveis[0]).toBe("https://app.vocare.com.br");
    expect(origensConfiaveis).toContain("https://vocare.vercel.app");
  });

  it("fora da Vercel não mexe em nada", async () => {
    const { origensConfiaveis } = await carregar({});
    expect(origensConfiaveis).toEqual(["http://localhost:3000"]);
  });
});
