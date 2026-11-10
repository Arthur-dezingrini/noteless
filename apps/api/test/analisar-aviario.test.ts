import { temAlvo } from "@vocare/shared";
import { describe, expect, it } from "vitest";

import { db } from "../src/db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../src/db/lotes";
import { ferramenta, instrucoes, normalizar, type GalpaoParaIa } from "../src/ia/analisar";
import { galpoesDaOrg } from "../src/lotes/galpoes-ia";
import { criarFazenda } from "./ajuda";

const galpao3: GalpaoParaIa = {
  instalacaoId: "g3",
  nome: "Galpão 3",
  loteId: "l7",
  loteCodigo: "L-07",
  semana: 31,
  femeas: 9850,
  machos: 1020,
};
const vazio = new Set<string>();

describe("instruções com galpões", () => {
  it("lista os galpões e os tipos do aviário", () => {
    const t = instrucoes("2026-03-10", [], [], [galpao3]);
    expect(t).toContain("- Galpão 3 (id g3): lote L-07 (lote id l7), semana 31");
    expect(t).toContain("apontar_galpao");
    expect(t).toContain("UM apontar_galpao por galpão citado");
  });

  it("sem galpões, os tipos do aviário ficam de fora", () => {
    const t = instrucoes("2026-03-10", [], [], []);
    expect(t).not.toContain("apontar_galpao");
    expect(t).not.toContain("pesar_lote");
  });
});

describe("normalizar operações do aviário", () => {
  const bruta = { tipo: "apontar_galpao", titulo: "x", alvo: "galpão 3", animalId: null, detalhe: "", trecho: "", confianca: 95, mortasFemeas: 12 };

  it("aceita galpão da lista", () => {
    const op = normalizar({ ...bruta, instalacaoId: "g3" }, vazio, vazio, [galpao3]);
    expect(op).toMatchObject({ tipo: "apontar_galpao", instalacaoId: "g3", mortasFemeas: 12, confianca: 95 });
  });

  it("galpão inexistente vira sem alvo, com confiança baixa", () => {
    const op = normalizar({ ...bruta, instalacaoId: "inexistente" }, vazio, vazio, [galpao3]);
    expect(op).toMatchObject({ instalacaoId: null });
    expect(op!.confianca).toBeLessThanOrEqual(60);
    expect(temAlvo(op!)).toBe(false);
  });

  it("pesar_lote e vacinar_lote só valem com lote da lista", () => {
    const peso = normalizar({ tipo: "pesar_lote", titulo: "", alvo: "L-07", animalId: null, detalhe: "", trecho: "", confianca: 90, loteId: "l7", sexo: "femea", pesoMedioG: 2100 }, vazio, vazio, [galpao3]);
    expect(peso).toMatchObject({ tipo: "pesar_lote", loteId: "l7", pesoMedioG: 2100 });
    const vac = normalizar({ tipo: "vacinar_lote", titulo: "", alvo: "L-99", animalId: null, detalhe: "", trecho: "", confianca: 90, loteId: "l99", vacina: "Bouba" }, vazio, vazio, [galpao3]);
    expect(vac).toMatchObject({ loteId: null });
    expect(vac!.confianca).toBeLessThanOrEqual(60);
  });

  it("aceita o código do lote (L-07) no lugar do id e o mapeia para o id", () => {
    const peso = normalizar({ tipo: "pesar_lote", titulo: "", alvo: "L-07", animalId: null, detalhe: "", trecho: "", confianca: 90, loteId: "L-07", sexo: "femea", pesoMedioG: 2100 }, vazio, vazio, [galpao3]);
    expect(peso).toMatchObject({ loteId: "l7" });
    expect(temAlvo(peso!)).toBe(true);
  });

  it("sem galpões, descarta os tipos do aviário", () => {
    expect(normalizar({ ...bruta, instalacaoId: "g3" }, vazio, vazio, [])).toBeNull();
  });
});

describe("ferramenta da IA", () => {
  const tipos = (f: ReturnType<typeof ferramenta>) =>
    (f.input_schema.properties.operacoes.items.properties.tipo as { enum: string[] }).enum;
  const antigos = ["agendar_consulta", "registrar_anotacao", "registrar_peso", "aplicar_vacina", "registrar_remedio", "registrar_parto", "cadastrar_animal"];

  it("sem galpões, só os 7 tipos antigos", () => {
    expect(tipos(ferramenta(false))).toEqual(antigos);
  });

  it("com galpões, inclui os 3 do aviário", () => {
    expect(tipos(ferramenta(true))).toEqual([...antigos, "apontar_galpao", "pesar_lote", "vacinar_lote"]);
  });
});

describe("galpoesDaOrg", () => {
  async function montar(orgId: string, codigo: string, nome: string, inicio: string, fim: string | null) {
    const [g] = await db.insert(instalacao).values({ organizationId: orgId, nome, tipo: "galpao" }).returning();
    const [l] = await db
      .insert(lote)
      .values({ organizationId: orgId, codigo, especie: "ave", dataAlojamento: "2026-01-05", idadeAlojamentoDias: 0, femeasIniciais: 1000, machosIniciais: 100 })
      .returning();
    await db.insert(alojamento).values({ organizationId: orgId, loteId: l!.id, instalacaoId: g!.id, inicio, fim, femeas: 1000, machos: 100 });
    return { g: g!, l: l! };
  }

  it("lista galpão com lote, semana e vivas descontando baixas; ignora outra org e alojamento encerrado", async () => {
    const a = await criarFazenda("Granja A", "granjaa");
    const b = await criarFazenda("Granja B", "granjab");
    const { g, l } = await montar(a.orgId, "L-07", "Galpão 3", "2026-01-05", null);
    await montar(a.orgId, "L-OLD", "Galpão 9", "2026-01-05", "2026-02-01");
    await montar(b.orgId, "L-B", "Galpão B", "2026-01-05", null);
    await db.insert(apontamentoAviario).values([
      { organizationId: a.orgId, instalacaoId: g.id, loteId: l.id, data: "2026-02-10", mortasFemeas: 10, eliminadasFemeas: 5, mortasMachos: 2 },
      { organizationId: a.orgId, instalacaoId: g.id, loteId: l.id, data: "2026-03-20", mortasFemeas: 100 },
    ]);

    const r = await galpoesDaOrg(a.orgId, "2026-03-10");
    expect(r).toEqual([
      { instalacaoId: g.id, nome: "Galpão 3", loteId: l.id, loteCodigo: "L-07", semana: 10, femeas: 985, machos: 98 },
    ]);
  });
});
