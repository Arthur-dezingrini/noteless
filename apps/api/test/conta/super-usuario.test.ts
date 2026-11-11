import { describe, expect, it } from "vitest";

import { chamar, criarFazenda, criarSuper } from "../ajuda";

describe("tipo de usuário", () => {
  it("usuário novo nasce comum e não vira super pelo update do perfil", async () => {
    const f = await criarFazenda("Tipo");
    await chamar(f.dono, "POST", "/api/auth/update-user", { tipo: "super" });
    const s = await chamar(f.dono, "GET", "/api/auth/get-session");
    expect(s.json.user.tipo).toBe("comum");
  });

  it("criarSuper devolve sessão com tipo super", async () => {
    const s = await chamar(await criarSuper(), "GET", "/api/auth/get-session");
    expect(s.json.user.tipo).toBe("super");
  });

  it("set-active para empresa sem vínculo é recusado, até para super", async () => {
    const a = await criarFazenda("Alfa");
    const b = await criarFazenda("Beta");
    const sup = await criarSuper();
    for (const quem of [a.dono, sup]) {
      const r = await chamar(quem, "POST", "/api/auth/organization/set-active", { organizationId: b.orgId });
      expect(r.status).toBeGreaterThanOrEqual(400);
      const s = await chamar(quem, "GET", "/api/auth/get-session");
      expect(s.json.session.activeOrganizationId).not.toBe(b.orgId);
    }
  });
});
