import { VERSAO_TERMOS } from "@vocare/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../../src/db";
import { aceiteTermos } from "../../src/db/tabelas/conta";
import { chamar, criarFazenda } from "../ajuda";

const ERRO_VERSAO = "Esta versão dos termos não é a atual. Recarregue a página.";
const aceitar = { versao: VERSAO_TERMOS };

describe("aceite dos termos", () => {
  it("sem login, 401", async () => {
    expect((await chamar(null, "GET", "/api/perfil/termos")).status).toBe(401);
    expect((await chamar(null, "POST", "/api/perfil/termos", aceitar)).status).toBe(401);
  });

  it("antes de aceitar, aceitoEm vem nulo", async () => {
    const f = await criarFazenda("Termos A");
    const r = await chamar(f.membro, "GET", "/api/perfil/termos");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ versao: VERSAO_TERMOS, aceitoEm: null });
  });

  it("aceita a versão atual e o aceite fica registrado", async () => {
    const f = await criarFazenda("Termos B");
    const r = await chamar(f.membro, "POST", "/api/perfil/termos", aceitar);
    expect(r.status).toBe(200);
    expect(typeof r.json.aceitoEm).toBe("string");
    expect((await chamar(f.membro, "GET", "/api/perfil/termos")).json).toEqual({ versao: VERSAO_TERMOS, aceitoEm: r.json.aceitoEm });
  });

  it("versão que não é a atual dá 400 e nada é gravado", async () => {
    const f = await criarFazenda("Termos C");
    const r = await chamar(f.dono, "POST", "/api/perfil/termos", { versao: "2020-01-01" });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ error: ERRO_VERSAO });
    expect((await chamar(f.dono, "GET", "/api/perfil/termos")).json.aceitoEm).toBeNull();
  });

  it("aceitar de novo mantém o primeiro registro", async () => {
    const f = await criarFazenda("Termos D");
    const primeiro = await chamar(f.dono, "POST", "/api/perfil/termos", aceitar);
    const segundo = await chamar(f.dono, "POST", "/api/perfil/termos", aceitar);
    expect(segundo.status).toBe(200);
    expect(segundo.json.aceitoEm).toBe(primeiro.json.aceitoEm);
    expect((await chamar(f.dono, "GET", "/api/perfil/termos")).json.aceitoEm).toBe(primeiro.json.aceitoEm);
  });

  it("o aceite de um usuário não vale para outro", async () => {
    const f = await criarFazenda("Termos E");
    await chamar(f.dono, "POST", "/api/perfil/termos", aceitar);
    expect((await chamar(f.admin, "GET", "/api/perfil/termos")).json.aceitoEm).toBeNull();
  });

  it("aceite de versão antiga não vale para a atual", async () => {
    const f = await criarFazenda("Termos Velhos");
    await db.insert(aceiteTermos).values({ userId: f.dono.id, versao: "2020-01-01" });
    expect((await chamar(f.dono, "GET", "/api/perfil/termos")).json.aceitoEm).toBeNull();
  });

  it("guarda só o primeiro IP de x-forwarded-for", async () => {
    const f = await criarFazenda("Termos IP");
    const r = await chamar(f.dono, "POST", "/api/perfil/termos", aceitar, { "x-forwarded-for": "200.1.1.1, 10.0.0.1" });
    expect(r.status).toBe(200);
    const [linha] = await db.select().from(aceiteTermos).where(eq(aceiteTermos.userId, f.dono.id));
    expect(linha!.ip).toBe("200.1.1.1");
  });
});
