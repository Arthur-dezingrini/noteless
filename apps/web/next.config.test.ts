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
