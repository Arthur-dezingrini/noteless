import { describe, expect, it } from "vitest";

import { chamar, criarFazenda, criarSuper } from "../ajuda";

describe("e-mail de teste do alerta", () => {
  it("super usuário pede o e-mail de teste", async () => {
    const r = await chamar(await criarSuper(), "POST", "/api/admin/alerta-teste");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ enviado: false }); // no teste não há destinatário nem chave da Resend
  });

  it("dono, administrador e membro não podem", async () => {
    const f = await criarFazenda("Alerta Teste");
    for (const p of [f.dono, f.admin, f.membro]) {
      expect((await chamar(p, "POST", "/api/admin/alerta-teste")).status).toBe(403);
    }
  });

  it("sem login, 401", async () => {
    expect((await chamar(null, "POST", "/api/admin/alerta-teste")).status).toBe(401);
  });
});
