import { describe, expect, it } from "vitest";

import { confirmarOcorrenciaSchema, corrigirOperacao, operacaoSchema, precisaAlvo, temAlvo, type Operacao } from "./ocorrencias";

const base = { titulo: "", alvo: "Thor", detalhe: "", confianca: 90, trecho: "" };

const peso: Operacao = { ...base, tipo: "registrar_peso", animalId: "a1", pesoKg: 480 };
const vacina: Operacao = {
  ...base,
  tipo: "aplicar_vacina",
  animalId: null,
  grupoId: null,
  vacina: "V10",
  dose: null,
  data: null,
  proximaData: null,
};
const cadastro: Operacao = {
  ...base,
  tipo: "cadastrar_animal",
  animalId: null,
  nome: "Bezerro 132",
  especie: "bovino",
  raca: null,
  sexo: null,
  nascimento: null,
};

describe("precisaAlvo / temAlvo", () => {
  it("cadastrar animal não precisa de alvo do cadastro", () => {
    expect(precisaAlvo(cadastro)).toBe(false);
    expect(temAlvo(cadastro)).toBe(true);
  });

  it("operação sem animal nem grupo não pode ser salva", () => {
    expect(precisaAlvo(vacina)).toBe(true);
    expect(temAlvo(vacina)).toBe(false);
  });

  it("um grupo serve de alvo", () => {
    expect(temAlvo({ ...vacina, grupoId: "g1" })).toBe(true);
  });

  it("um animal serve de alvo", () => {
    expect(temAlvo(peso)).toBe(true);
  });
});

describe("operacaoSchema", () => {
  it("recusa peso zero ou absurdo", () => {
    expect(operacaoSchema.safeParse({ ...peso, pesoKg: 0 }).success).toBe(false);
    expect(operacaoSchema.safeParse({ ...peso, pesoKg: 9000 }).success).toBe(false);
  });

  it("recusa tipo que a IA não pode propor", () => {
    expect(operacaoSchema.safeParse({ ...peso, tipo: "apagar_animal" }).success).toBe(false);
  });

  it("recusa confiança fora de 0–100", () => {
    expect(operacaoSchema.safeParse({ ...peso, confianca: 150 }).success).toBe(false);
  });
});

describe("corrigirOperacao", () => {
  it("sem correção devolve a mesma operação", () => {
    expect(corrigirOperacao(peso, undefined)).toEqual({ ok: true, op: peso });
  });

  it("aplica a correção e guarda o que a IA tinha dito", () => {
    const r = corrigirOperacao(peso, { pesoKg: 462 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.op).toMatchObject({ pesoKg: 462, original: { pesoKg: 480 } });
  });

  it("ignora campo que o tipo não deixa corrigir", () => {
    const r = corrigirOperacao(peso, { confianca: 10, titulo: "outro" });
    expect(r).toEqual({ ok: true, op: peso });
  });

  it("valor igual ao atual não conta como correção", () => {
    const r = corrigirOperacao(peso, { pesoKg: 480 });
    expect(r).toEqual({ ok: true, op: peso });
  });

  it("corrigir de novo mantém o valor original da IA, não o da primeira correção", () => {
    const primeira = corrigirOperacao(peso, { pesoKg: 462 });
    if (!primeira.ok) throw new Error(primeira.error);
    const segunda = corrigirOperacao(primeira.op, { pesoKg: 470 });
    if (!segunda.ok) throw new Error(segunda.error);
    expect(segunda.op).toMatchObject({ pesoKg: 470, original: { pesoKg: 480 } });
  });

  it("correção inválida volta com a mensagem do contrato", () => {
    expect(corrigirOperacao(peso, { pesoKg: -5 })).toEqual({ ok: false, error: "O peso precisa ser maior que zero." });
  });

  it("trocar o alvo para um grupo funciona nos tipos que aceitam grupo", () => {
    const r = corrigirOperacao(vacina, { grupoId: "g1" });
    expect(r.ok && temAlvo(r.op)).toBe(true);
  });

  it("pesagem não aceita grupo como alvo", () => {
    const r = corrigirOperacao(peso, { grupoId: "g1" });
    expect(r).toEqual({ ok: true, op: peso });
  });
});

describe("confirmarOcorrenciaSchema", () => {
  it("aceita índices e correções por índice", () => {
    expect(confirmarOcorrenciaSchema.safeParse({ operacoes: [0, 2], correcoes: { "0": { pesoKg: 462 } } }).success).toBe(true);
  });

  it("recusa chave de correção que não é índice", () => {
    expect(confirmarOcorrenciaSchema.safeParse({ operacoes: [0], correcoes: { abc: {} } }).success).toBe(false);
  });
});
