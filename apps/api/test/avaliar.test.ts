import type { Operacao } from "@vocare/shared";
import { describe, expect, it } from "vitest";

import { avaliarCaso, consolidar, iguais } from "../src/modulos/notas/ia/avaliar";

const base = { titulo: "", alvo: "", detalhe: "", trecho: "", grupoId: null, confianca: 95 };
const peso = (animalId: string | null, pesoKg: number, confianca = 95): Operacao => ({
  ...base,
  tipo: "registrar_peso",
  animalId,
  pesoKg,
  confianca,
});
const vacina = (grupoId: string, nome: string): Operacao => ({
  ...base,
  tipo: "aplicar_vacina",
  animalId: null,
  grupoId,
  vacina: nome,
  dose: null,
  data: null,
  proximaData: null,
});
const cadastro = (nome: string): Operacao => ({
  ...base,
  tipo: "cadastrar_animal",
  animalId: null,
  nome,
  especie: "caprino",
  raca: null,
  sexo: "macho",
  nascimento: null,
});

describe("iguais", () => {
  it("ignora acento, caixa e aceita um texto contido no outro", () => {
    expect(iguais("antirrabica", "Vacina Antirrábica")).toBe(true);
    expect(iguais("aftosa", "raiva")).toBe(false);
  });

  it("compara número com folga mínima e não confunde datas por prefixo", () => {
    expect(iguais(412, 412.001)).toBe(true);
    expect(iguais(412, 421)).toBe(false);
    expect(iguais("2026-11-1", "2026-11-10")).toBe(false);
  });

  it("vazio só é igual a vazio", () => {
    expect(iguais(null, undefined)).toBe(true);
    expect(iguais(null, "14:00")).toBe(false);
    expect(iguais("14:00", null)).toBe(false);
  });
});

describe("avaliarCaso", () => {
  it("tudo certo: acerto, campos certos e proposta marcada como certa", () => {
    const r = avaliarCaso([{ tipo: "registrar_peso", animalId: "a1", campos: { pesoKg: 412 } }], [peso("a1", 412)]);
    expect(r).toMatchObject({ acertos: 1, camposConferidos: 1, camposCertos: 1, faltaram: [], inventadas: [] });
    expect(r.confiancas).toEqual([{ confianca: 95, certa: true }]);
  });

  it("alvo errado conta como faltou e como inventada", () => {
    const r = avaliarCaso([{ tipo: "registrar_peso", animalId: "a1" }], [peso("a2", 412)]);
    expect(r.acertos).toBe(0);
    expect(r.faltaram).toHaveLength(1);
    expect(r.inventadas).toHaveLength(1);
  });

  it("campo errado casa a operação mas não a deixa certa", () => {
    const r = avaliarCaso([{ tipo: "registrar_peso", animalId: "a1", campos: { pesoKg: 412 } }], [peso("a1", 41.2)]);
    expect(r.acertos).toBe(1);
    expect(r.errosDeCampo).toEqual([{ tipo: "registrar_peso", campo: "pesoKg", esperado: 412, obtido: 41.2 }]);
    expect(r.confiancas[0]?.certa).toBe(false);
  });

  it("com duas candidatas, fica com a que acerta mais campos", () => {
    const r = avaliarCaso([{ tipo: "registrar_peso", animalId: "a1", campos: { pesoKg: 420 } }], [peso("a1", 400), peso("a1", 420)]);
    expect(r.camposCertos).toBe(1);
    expect((r.inventadas[0] as { pesoKg: number }).pesoKg).toBe(400);
  });

  it("áudio sem ação em que a IA propõe algo: tudo inventado", () => {
    const r = avaliarCaso([], [peso("a1", 10)]);
    expect(r).toMatchObject({ esperadas: 0, acertos: 0 });
    expect(r.inventadas).toHaveLength(1);
  });

  it("grupo casa pelo grupoId e cadastro casa pelo nome", () => {
    const r = avaliarCaso(
      [
        { tipo: "aplicar_vacina", grupoId: "g1", campos: { vacina: "aftosa" } },
        { tipo: "cadastrar_animal", campos: { nome: "Faísca", sexo: "macho" } },
      ],
      [cadastro("faisca"), vacina("g1", "Aftosa")],
    );
    expect(r.acertos).toBe(2);
    expect(r.camposCertos).toBe(3);
  });
});

describe("consolidar", () => {
  it("calcula precisão, cobertura, F1, casos perfeitos e calibração por faixa", () => {
    const c = consolidar([
      avaliarCaso([{ tipo: "registrar_peso", animalId: "a1", campos: { pesoKg: 412 } }], [peso("a1", 412, 95)]),
      avaliarCaso([{ tipo: "registrar_peso", animalId: "a2" }], [peso(null, 300, 50)]),
      avaliarCaso([], []),
    ]);
    expect(c.casos).toBe(3);
    expect(c.casosPerfeitos).toBe(2);
    expect(c.precisao).toBe(0.5);
    expect(c.cobertura).toBe(0.5);
    expect(c.f1).toBe(0.5);
    expect(c.calibracao).toEqual([
      { faixa: "90–100", propostas: 1, certas: 1, taxa: 1 },
      { faixa: "70–89", propostas: 0, certas: 0, taxa: null },
      { faixa: "0–69", propostas: 1, certas: 0, taxa: 0 },
    ]);
    expect(c.porTipo).toEqual([{ tipo: "registrar_peso", esperadas: 2, acertos: 1, cobertura: 0.5 }]);
  });
});
