import { afterEach, describe, expect, it, vi } from "vitest";

import { corpoJson } from "./json";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("corpoJson", () => {
  it("devolve o JSON da api", async () => {
    const res = new Response(JSON.stringify({ user: { id: "1" } }), { headers: { "content-type": "application/json" } });
    expect(await corpoJson(res)).toEqual({ user: { id: "1" } });
  });

  it("aceita o null que o login devolve para quem não está logado", async () => {
    expect(await corpoJson(new Response("null"))).toBeNull();
  });

  it("HTML no lugar de JSON (proteção de deploy, página de erro) vira null e fica no log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = new Response("<!DOCTYPE html><title>Authentication Required</title>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });

    expect(await corpoJson(res)).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("resposta não é JSON (200 text/html)"));
  });

  it("corpo vazio também não quebra", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await corpoJson(new Response(""))).toBeNull();
  });
});
