import { temAlvo } from "@vocare/shared";
import { describe, expect, it } from "vitest";

import { instrucoes, normalizar, type GalpaoParaIa } from "../src/ia/analisar";

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
    expect(t).toContain("- Galpão 3 (id g3): lote L-07, semana 31");
    expect(t).toContain("apontar_galpao");
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

  it("sem galpões, descarta os tipos do aviário", () => {
    expect(normalizar({ ...bruta, instalacaoId: "g3" }, vazio, vazio, [])).toBeNull();
  });
});
