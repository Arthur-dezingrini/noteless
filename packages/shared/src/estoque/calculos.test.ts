import { describe, expect, it } from "vitest";

import { arredondar, converterParaUnidade, diasRestantes, novoCustoMedio, repartirFefo } from "./calculos";

describe("novoCustoMedio", () => {
  it("pondera o saldo atual com a compra", () => {
    expect(novoCustoMedio(100, 2, 100, 4)).toBe(3);
  });

  it("saldo negativo conta como zero", () => {
    expect(novoCustoMedio(-50, 2, 100, 4)).toBe(4);
  });

  it("sem saldo e sem quantidade devolve o custo da compra", () => {
    expect(novoCustoMedio(0, 0, 0, 5)).toBe(5);
  });

  it("arredonda em 4 casas", () => {
    expect(novoCustoMedio(3, 1, 3, 2)).toBe(1.5);
    expect(novoCustoMedio(1, 1, 2, 1.12345)).toBe(1.0823);
  });
});

describe("repartirFefo", () => {
  const lotes = [
    { chave: "A", quantidade: 10, validade: "2026-12-01", desde: "2026-01-01" },
    { chave: "B", quantidade: 5, validade: "2026-11-30", desde: "2026-02-01" },
    { chave: "C", quantidade: 100, validade: null, desde: "2025-12-01" },
  ];

  it("sai primeiro o que vence antes", () => {
    expect(repartirFefo(lotes, 12)).toEqual({
      partes: [
        { chave: "B", quantidade: 5 },
        { chave: "A", quantidade: 7 },
      ],
      sobra: 0,
    });
  });

  it("sem validade fica por último e o que falta vira sobra", () => {
    expect(repartirFefo(lotes, 200)).toEqual({
      partes: [
        { chave: "B", quantidade: 5 },
        { chave: "A", quantidade: 10 },
        { chave: "C", quantidade: 100 },
      ],
      sobra: 85,
    });
  });

  it("no empate de validade sai antes o que entrou primeiro", () => {
    const r = repartirFefo(
      [
        { chave: "novo", quantidade: 5, validade: "2026-12-01", desde: "2026-03-01" },
        { chave: "velho", quantidade: 5, validade: "2026-12-01", desde: "2026-01-01" },
      ],
      6,
    );
    expect(r.partes).toEqual([
      { chave: "velho", quantidade: 5 },
      { chave: "novo", quantidade: 1 },
    ]);
  });

  it("ignora saldo zerado ou negativo", () => {
    const r = repartirFefo(
      [
        { chave: "neg", quantidade: -3, validade: "2026-01-01", desde: "2026-01-01" },
        { chave: "zero", quantidade: 0, validade: "2026-01-02", desde: "2026-01-01" },
        { chave: "ok", quantidade: 4, validade: "2026-06-01", desde: "2026-01-01" },
      ],
      6,
    );
    expect(r).toEqual({ partes: [{ chave: "ok", quantidade: 4 }], sobra: 2 });
  });

  it("não deixa resíduo de ponto flutuante", () => {
    const r = repartirFefo([{ chave: "A", quantidade: 0.3, validade: null, desde: "2026-01-01" }], 0.1 + 0.2);
    expect(r).toEqual({ partes: [{ chave: "A", quantidade: 0.3 }], sobra: 0 });
  });
});

describe("conversões", () => {
  it("embalagem vira unidade de estoque", () => {
    expect(converterParaUnidade(300, 25)).toBe(7500);
    expect(converterParaUnidade(1.5, 0.3333)).toBe(0.5);
  });

  it("dias restantes pela média de 7 dias", () => {
    expect(diasRestantes(1000, 1400)).toBe(5);
    expect(diasRestantes(10, 0)).toBeNull();
    expect(diasRestantes(-5, 70)).toBe(0);
  });

  it("arredondar tira o resíduo de ponto flutuante", () => {
    expect(arredondar(480.5 + 0.1 + 0.2, 3)).toBe(480.8);
  });
});
