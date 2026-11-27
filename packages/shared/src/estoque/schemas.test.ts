import { describe, expect, it } from "vitest";

import { criarProdutoSchema, entradaManualSchema, saidaInputSchema, transferenciaInputSchema } from "./schemas";

const erro = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("schemas do estoque", () => {
  it("quantidade zero é recusada", () => {
    const r = saidaInputSchema.safeParse({ produtoId: "p", localId: "l", quantidade: 0, data: "2026-11-20" });
    expect(r.success).toBe(false);
    expect(erro(r)).toBe("A quantidade deve ser maior que zero.");
  });

  it("entrada sem itens é recusada", () => {
    const r = entradaManualSchema.safeParse({ data: "2026-11-20", itens: [] });
    expect(r.success).toBe(false);
    expect(erro(r)).toBe("Inclua pelo menos um item.");
  });

  it("item de entrada vem com fator 1 por padrão", () => {
    const r = entradaManualSchema.parse({ data: "2026-11-20", itens: [{ produtoId: "p", localId: "l", quantidade: 10 }] });
    expect(r.itens[0]?.fator).toBe(1);
  });

  it("transferência para o mesmo local é recusada", () => {
    const r = transferenciaInputSchema.safeParse({ produtoId: "p", deLocalId: "x", paraLocalId: "x", quantidade: 1, data: "2026-11-20" });
    expect(r.success).toBe(false);
    expect(erro(r)).toBe("Escolha um local de destino diferente.");
  });

  it("categoria fora da lista é recusada", () => {
    const r = criarProdutoSchema.safeParse({ nome: "Milho", categoria: "graos", unidade: "kg" });
    expect(r.success).toBe(false);
  });

  it("data inválida é recusada", () => {
    expect(saidaInputSchema.safeParse({ produtoId: "p", localId: "l", quantidade: 1, data: "20/11/2026" }).success).toBe(false);
  });
});
