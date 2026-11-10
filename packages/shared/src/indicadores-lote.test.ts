import { describe, expect, it } from "vitest";
import {
  avesVivas,
  consolidarSemanas,
  indicadoresDoDia,
  indicadoresDoLote,
  mortalidadeAlta,
  semanaDeVida,
  type ApontamentoDia,
} from "./indicadores-lote";

const base = { data: "2026-01-02", instalacaoId: "g" };
const lote = { dataAlojamento: "2026-01-01", idadeAlojamentoDias: 0, femeasIniciais: 1000, machosIniciais: 100 };

describe("semanaDeVida", () => {
  it("conta semanas a partir do alojamento e da idade", () => {
    expect(semanaDeVida("2026-01-01", 0, "2026-01-01")).toBe(1);
    expect(semanaDeVida("2026-01-01", 0, "2026-01-08")).toBe(2);
    expect(semanaDeVida("2026-01-01", 140, "2026-01-01")).toBe(21);
  });
});

describe("avesVivas", () => {
  const aps: ApontamentoDia[] = [{ ...base, mortasFemeas: 3, eliminadasFemeas: 2, mortasMachos: 1 }];
  it("desconta as baixas até a data, inclusive", () => {
    expect(avesVivas({ femeas: 1000, machos: 100 }, aps, "2026-01-02")).toEqual({ femeas: 995, machos: 99 });
    expect(avesVivas({ femeas: 1000, machos: 100 }, aps, "2026-01-01")).toEqual({ femeas: 1000, machos: 100 });
  });
});

describe("indicadoresDoDia", () => {
  it("calcula postura, incubáveis e ração", () => {
    const r = indicadoresDoDia({ ...base, ovosTotal: 800, ovosIncubaveis: 760, racaoKg: 165 }, { femeas: 1000, machos: 100 });
    expect(r.posturaPct).toBe(80);
    expect(r.incubaveisPct).toBe(95);
    expect(r.racaoGAveDia).toBe(150);
  });
  it("devolve null em vez de NaN/Infinity", () => {
    const r = indicadoresDoDia({ ...base, ovosTotal: 10, racaoKg: 0, aguaL: 50 }, { femeas: 0, machos: 100 });
    expect(r.posturaPct).toBeNull();
    expect(r.aguaRacao).toBeNull();
    expect(Object.values(r).every((v) => v === null || Number.isFinite(v))).toBe(true);
  });
});

describe("mortalidadeAlta", () => {
  it("alerta acima de 0,1% das vivas", () => {
    expect(mortalidadeAlta({ ...base, mortasFemeas: 2 }, { femeas: 1000, machos: 0 })).toBe(true);
    expect(mortalidadeAlta({ ...base, mortasFemeas: 1 }, { femeas: 1000, machos: 0 })).toBe(false);
  });
});

describe("indicadoresDoLote", () => {
  it("soma galpões no mesmo dia e usa a semana de hoje", () => {
    const aps: ApontamentoDia[] = [
      { data: "2026-01-02", instalacaoId: "a", mortasFemeas: 5, ovosTotal: 400, ovosIncubaveis: 380, racaoKg: 80 },
      { data: "2026-01-02", instalacaoId: "b", mortasMachos: 1, ovosTotal: 400, ovosIncubaveis: 380, racaoKg: 85 },
    ];
    const r = indicadoresDoLote(lote, aps, "2026-01-02");
    expect(r.vivas).toEqual({ femeas: 995, machos: 99 });
    expect(r.mortalidadeAcumuladaPct).toBe(0.5);
    expect(r.posturaSemanaPct).toBe(80);
    expect(r.incubaveisPorFemea).toBe(0.76);
    expect(r.racaoGAveDiaSemana).toBe(150);
  });
});

describe("consolidarSemanas", () => {
  it("8 dias de apontamento viram 2 semanas", () => {
    const aps: ApontamentoDia[] = Array.from({ length: 8 }, (_, i) => ({
      data: `2026-01-0${i + 1}`,
      instalacaoId: "g",
      mortasFemeas: 1,
    }));
    const s = consolidarSemanas(lote, aps, [
      { data: "2026-01-03", sexo: "femea", pesoMedioG: 100, uniformidadePct: 80 },
      { data: "2026-01-05", sexo: "femea", pesoMedioG: 120, uniformidadePct: 85 },
    ]);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ semana: 1, inicio: "2026-01-01", fim: "2026-01-07", mortas: 7, pesoFemeaG: 120, pesoMachoG: null });
    expect(s[1]).toMatchObject({ semana: 2, inicio: "2026-01-08", mortas: 1 });
  });
});
