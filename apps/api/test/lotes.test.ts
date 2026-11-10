import { describe, expect, it } from "vitest";

import { db } from "../src/db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../src/db/lotes";
import { chamar, criarFazenda } from "./ajuda";

describe("tabelas do aviário", () => {
  it("migration cria as tabelas do aviário", async () => {
    const f = await criarFazenda("Granja Teste");
    const [galpao] = (await db.insert(instalacao).values({ organizationId: f.orgId, nome: "Galpão 1", tipo: "galpao", capacidade: 5000, areaM2: "1200.50" }).returning()) as [typeof instalacao.$inferSelect];
    const [l] = (await db
      .insert(lote)
      .values({ organizationId: f.orgId, codigo: "L-001", especie: "galinha", dataAlojamento: "2026-01-05", femeasIniciais: 4000, machosIniciais: 400 })
      .returning()) as [typeof lote.$inferSelect];
    await db.insert(alojamento).values({ organizationId: f.orgId, loteId: l.id, instalacaoId: galpao.id, inicio: "2026-01-05", femeas: 4000, machos: 400 });
    await db.insert(apontamentoAviario).values({ organizationId: f.orgId, instalacaoId: galpao.id, loteId: l.id, data: "2026-02-01", ovosTotal: 3000, racaoKg: "480.5" });

    const lidos = await db.select().from(apontamentoAviario);
    expect(lidos).toHaveLength(1);
    expect(lidos[0]?.ovosTotal).toBe(3000);
    expect(l.fase).toBe("recria");
    expect(l.situacao).toBe("ativo");
    expect(l.idadeAlojamentoDias).toBe(0);
    expect(galpao.ativa).toBe(true);

    await expect(
      db.insert(apontamentoAviario).values({ organizationId: f.orgId, instalacaoId: galpao.id, loteId: l.id, data: "2026-02-01" }),
    ).rejects.toThrow();
  });
});

describe("rotas de instalações", () => {
  it("dono cria, lista com loteAtual; admin edita; membro só lê; outra fazenda não enxerga; nome repetido dá 409", async () => {
    const f = await criarFazenda("Granja Rotas");
    const outra = await criarFazenda("Outra Granja");
    const base = `/api/org/${f.orgId}/instalacoes`;

    const criada = await chamar(f.dono, "POST", base, { nome: "Galpão 1", tipo: "galpao", capacidade: 5000, areaM2: 1200.5 });
    expect(criada.status).toBe(201);
    expect(criada.json).toMatchObject({ nome: "Galpão 1", tipo: "galpao", capacidade: 5000, areaM2: 1200.5, ativa: true, loteAtual: null });

    const [l] = (await db
      .insert(lote)
      .values({ organizationId: f.orgId, codigo: "L-9", especie: "galinha", dataAlojamento: "2026-01-05", femeasIniciais: 10, machosIniciais: 1 })
      .returning()) as [typeof lote.$inferSelect];
    await db.insert(alojamento).values({ organizationId: f.orgId, loteId: l.id, instalacaoId: criada.json.id, inicio: "2026-01-05", femeas: 10, machos: 1 });
    await chamar(f.dono, "POST", base, { nome: "Baia A", tipo: "baia" });

    const lista = await chamar(f.membro, "GET", base);
    expect(lista.status).toBe(200);
    expect(lista.json.map((i: any) => i.nome)).toEqual(["Baia A", "Galpão 1"]);
    expect(lista.json[1].loteAtual).toEqual({ id: l.id, codigo: "L-9" });

    const editada = await chamar(f.admin, "PATCH", `${base}/${criada.json.id}`, { capacidade: 6000 });
    expect(editada.status).toBe(200);
    expect(editada.json).toMatchObject({ capacidade: 6000, nome: "Galpão 1" });

    expect((await chamar(f.membro, "POST", base, { nome: "X", tipo: "pasto" })).status).toBe(403);
    expect((await chamar(f.membro, "PATCH", `${base}/${criada.json.id}`, { capacidade: 1 })).status).toBe(403);

    const alheio = await chamar(outra.dono, "PATCH", `/api/org/${outra.orgId}/instalacoes/${criada.json.id}`, { capacidade: 1 });
    expect(alheio.status).toBe(404);
    expect((await chamar(outra.dono, "GET", `/api/org/${outra.orgId}/instalacoes`)).json).toEqual([]);
    expect((await chamar(outra.dono, "GET", base)).status).toBe(403);

    const repetida = await chamar(f.dono, "POST", base, { nome: "Galpão 1", tipo: "galpao" });
    expect(repetida.status).toBe(409);
    expect(repetida.json.error).toBe("Já existe uma instalação com esse nome.");
    const renomear = await chamar(f.dono, "PATCH", `${base}/${criada.json.id}`, { nome: "Baia A" });
    expect(renomear.status).toBe(409);

    expect((await chamar(f.dono, "POST", base, { nome: "", tipo: "galpao" })).status).toBe(400);
  });
});
