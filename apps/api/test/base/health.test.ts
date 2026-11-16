import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { db } from "../../src/db";

afterEach(() => vi.restoreAllMocks());

describe("/health", () => {
  it("sem ?banco responde 200 sem acordar o banco e não deixa guardar em cache", async () => {
    const consulta = vi.spyOn(db, "execute");
    const r = await app.request("/health");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(consulta).not.toHaveBeenCalled();
  });

  it("com ?banco=1 e o banco no ar responde 200", async () => {
    const r = await app.request("/health?banco=1");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, banco: "ok" });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("com ?banco=1 e o banco fora responde 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("fora"));
    const r = await app.request("/health?banco=1");
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ ok: false, banco: "falhou" });
  });
});
