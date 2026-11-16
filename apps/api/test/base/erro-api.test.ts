import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { alertar } from "../../src/base/alerta";

vi.mock("../../src/base/alerta", async (original) => ({
  ...(await original<typeof import("../../src/base/alerta")>()),
  alertar: vi.fn(async () => ({ enviado: true })),
}));

app.get("/teste/quebra", () => {
  throw new Error("quebrou");
});
app.get("/teste/bule", () => {
  throw new HTTPException(418, { message: "bule" });
});

beforeEach(() => vi.mocked(alertar).mockClear());

describe("erro não tratado na api", () => {
  it("responde 500 em JSON e alerta erro-api", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await app.request("/teste/quebra");
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "Erro interno." });
    expect(alertar).toHaveBeenCalledWith("erro-api", { mensagem: "quebrou", rota: "GET /teste/quebra", orgId: undefined });
  });

  it("HTTPException segue com a resposta dela e não alerta", async () => {
    const r = await app.request("/teste/bule");
    expect(r.status).toBe(418);
    expect(alertar).not.toHaveBeenCalled();
  });
});
