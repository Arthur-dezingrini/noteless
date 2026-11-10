import { describe, expect, it } from "vitest";

import { db } from "../src/db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../src/db/lotes";
import { criarFazenda } from "./ajuda";

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
