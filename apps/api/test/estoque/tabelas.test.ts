import { describe, expect, it } from "vitest";

import { db } from "../../src/db";
import { instalacao } from "../../src/db/tabelas/aviario";
import { entrada, inventario, localEstoque, produto, saldoEstoque } from "../../src/db/tabelas/estoque";
import { criarFazenda } from "../ajuda";

describe("tabelas do estoque", () => {
  it("migration cria as tabelas do estoque e as restrições de unicidade", async () => {
    const f = await criarFazenda("Estoque Tabelas");
    const outra = await criarFazenda("Estoque Tabelas Outra");
    const [galpao] = await db.insert(instalacao).values({ organizationId: f.orgId, nome: "Galpão 1", tipo: "galpao" }).returning();

    const [racao] = await db
      .insert(produto)
      .values({ organizationId: f.orgId, nome: "Ração postura", categoria: "racao", unidade: "kg" })
      .returning();
    expect(racao?.custoMedio).toBe("0.0000");
    expect(racao?.ativo).toBe(true);
    expect(racao?.controlaLote).toBe(false);

    const [silo] = await db
      .insert(localEstoque)
      .values({ organizationId: f.orgId, nome: "Silo 1", tipo: "silo", instalacaoId: galpao!.id })
      .returning();
    await db.insert(saldoEstoque).values({ organizationId: f.orgId, produtoId: racao!.id, localId: silo!.id, quantidade: "480.500" });

    // Mesmo nome de produto: recusado na mesma organização, aceito em outra.
    await expect(db.insert(produto).values({ organizationId: f.orgId, nome: "Ração postura", categoria: "racao", unidade: "kg" })).rejects.toThrow();
    await db.insert(produto).values({ organizationId: outra.orgId, nome: "Ração postura", categoria: "racao", unidade: "kg" });

    // Um silo ativo por galpão; um inativo não conta.
    await expect(
      db.insert(localEstoque).values({ organizationId: f.orgId, nome: "Silo 2", tipo: "silo", instalacaoId: galpao!.id }),
    ).rejects.toThrow();
    await db.insert(localEstoque).values({ organizationId: f.orgId, nome: "Silo velho", tipo: "silo", instalacaoId: galpao!.id, ativo: false });

    // Um saldo por produto, local e lote.
    await expect(
      db.insert(saldoEstoque).values({ organizationId: f.orgId, produtoId: racao!.id, localId: silo!.id, quantidade: "1" }),
    ).rejects.toThrow();

    // A mesma NF-e não entra duas vezes.
    const chaveNfe = "35261112345678000199550010000012341000012345";
    await db.insert(entrada).values({ organizationId: f.orgId, data: "2026-11-20", origem: "nfe", chaveNfe });
    await expect(db.insert(entrada).values({ organizationId: f.orgId, data: "2026-11-21", origem: "nfe", chaveNfe })).rejects.toThrow();
    await db.insert(entrada).values({ organizationId: f.orgId, data: "2026-11-21", origem: "tela" });
    await db.insert(entrada).values({ organizationId: f.orgId, data: "2026-11-22", origem: "tela" });

    // Um inventário aberto por local.
    await db.insert(inventario).values({ organizationId: f.orgId, localId: silo!.id });
    await expect(db.insert(inventario).values({ organizationId: f.orgId, localId: silo!.id })).rejects.toThrow();
  });
});
