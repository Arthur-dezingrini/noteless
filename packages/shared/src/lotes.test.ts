import { describe, expect, it } from "vitest";
import { criarLoteSchema, pesagemLoteInputSchema, valoresApontamentoSchema } from "./lotes";

describe("valoresApontamentoSchema", () => {
  it("aceita vazio e valores válidos", () => {
    expect(valoresApontamentoSchema.safeParse({}).success).toBe(true);
    expect(valoresApontamentoSchema.safeParse({ mortasFemeas: 3, racaoKg: 512.5 }).success).toBe(true);
  });

  it("recusa negativo e fracionário em contagem", () => {
    expect(valoresApontamentoSchema.safeParse({ mortasFemeas: -1 }).success).toBe(false);
    expect(valoresApontamentoSchema.safeParse({ mortasMachos: 1.5 }).success).toBe(false);
  });

  it("recusa soma das classes acima do total de ovos", () => {
    const r = valoresApontamentoSchema.safeParse({ ovosTotal: 100, ovosIncubaveis: 90, ovosTrincados: 15 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("A soma das classes de ovo passa do total.");
  });

  it("sem total, as classes passam", () => {
    expect(valoresApontamentoSchema.safeParse({ ovosIncubaveis: 90, ovosTrincados: 15 }).success).toBe(true);
  });
});

describe("criarLoteSchema", () => {
  const base = { codigo: "L1", dataAlojamento: "2026-01-10" };

  it("recusa lote sem galpões", () => {
    expect(criarLoteSchema.safeParse({ ...base, galpoes: [] }).success).toBe(false);
  });

  it("aplica os valores padrão", () => {
    const r = criarLoteSchema.parse({ ...base, galpoes: [{ instalacaoId: "g1", femeas: 100, machos: 10 }] });
    expect(r.especie).toBe("ave");
    expect(r.idadeAlojamentoDias).toBe(0);
    expect(r.fase).toBe("recria");
  });
});

describe("pesagemLoteInputSchema", () => {
  it("recusa uniformidade acima de 100", () => {
    const r = pesagemLoteInputSchema.safeParse({ data: "2026-01-10", sexo: "femea", pesoMedioG: 500, uniformidadePct: 101 });
    expect(r.success).toBe(false);
  });
});
