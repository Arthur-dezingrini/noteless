import { getRedirectUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

const abrir = (caminho: string) => unstable_getResponseFromNextConfig({ url: `http://localhost:3000${caminho}`, nextConfig });

describe("redirecionamentos", () => {
  it("aviso antigo de /ocorrencias abre a mesma nota em /notas", async () => {
    const res = await abrir("/ocorrencias?id=abc");
    expect(res.status).toBe(308);
    expect(getRedirectUrl(res)).toBe("http://localhost:3000/notas?id=abc");
  });

  it.each([
    ["/lotes", "/aviario/lotes"],
    ["/lotes/abc", "/aviario/lotes/abc"],
    ["/configuracoes/galpoes", "/aviario/galpoes"],
    ["/grupos", "/animais/grupos"],
    ["/agenda?dia=2026-11-10", "/saude/agenda?dia=2026-11-10"],
    ["/prontuarios?id=p1", "/saude/prontuarios?id=p1"],
  ])("endereço antigo %s vai para %s", async (de, para) => {
    const res = await abrir(de);
    expect(res.status).toBe(308);
    expect(getRedirectUrl(res)).toBe(`http://localhost:3000${para}`);
  });

  it("/notas abre direto, sem redirecionar", async () => {
    expect(getRedirectUrl(await abrir("/notas?id=abc"))).toBeNull();
  });
});

describe("cabeçalhos de segurança", () => {
  it.each(["/login", "/notas?id=abc", "/animais/abc"])("%s sai com os cabeçalhos", async (caminho) => {
    const res = await abrir(caminho);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("o que vem da api também", async () => {
    const res = await abrir("/api/org/x/ocorrencias");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
