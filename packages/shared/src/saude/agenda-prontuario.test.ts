import { describe, expect, it } from "vitest";

import { criarConsultaSchema } from "./consultas";
import { criarProntuarioSchema } from "./prontuarios";

describe("criarConsultaSchema", () => {
  const consulta = { data: "2026-10-02", hora: "09:30", duracaoMin: 30, tipo: "retorno" };

  it("precisa de um animal ou de um grupo", () => {
    const r = criarConsultaSchema.safeParse(consulta);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Escolha o animal.");
    expect(criarConsultaSchema.safeParse({ ...consulta, animalId: "a1" }).success).toBe(true);
    expect(criarConsultaSchema.safeParse({ ...consulta, grupoId: "g1" }).success).toBe(true);
  });

  it("recusa hora impossível", () => {
    expect(criarConsultaSchema.safeParse({ ...consulta, animalId: "a1", hora: "24:00" }).success).toBe(false);
    expect(criarConsultaSchema.safeParse({ ...consulta, animalId: "a1", hora: "9:30" }).success).toBe(false);
  });

  it("duração entre 5 min e 8 h, vinda do formulário como texto", () => {
    expect(criarConsultaSchema.parse({ ...consulta, animalId: "a1", duracaoMin: "45" }).duracaoMin).toBe(45);
    expect(criarConsultaSchema.safeParse({ ...consulta, animalId: "a1", duracaoMin: 2 }).success).toBe(false);
    expect(criarConsultaSchema.safeParse({ ...consulta, animalId: "a1", duracaoMin: 600 }).success).toBe(false);
  });
});

describe("criarProntuarioSchema", () => {
  const atendimento = { animalId: "a1", data: "2026-09-21", tipo: "consulta" };

  it("atendimento vazio não entra", () => {
    const r = criarProntuarioSchema.safeParse(atendimento);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Escreva pelo menos a queixa ou o diagnóstico.");
  });

  it("basta um remédio receitado", () => {
    const r = criarProntuarioSchema.safeParse({ ...atendimento, remedios: [{ nome: "Otomax" }] });
    expect(r.success).toBe(true);
    // "como dar" em branco vira "" em vez de faltar.
    expect(r.data?.remedios[0]).toEqual({ nome: "Otomax", como: "" });
  });

  it("preenche listas vazias e tira espaços do texto", () => {
    const r = criarProntuarioSchema.parse({ ...atendimento, diagnostico: "  Otite externa.  " });
    expect(r).toMatchObject({ diagnostico: "Otite externa.", queixa: "", exame: [], remedios: [], exames: [] });
  });

  it("exige animal", () => {
    const r = criarProntuarioSchema.safeParse({ ...atendimento, animalId: "", queixa: "Mancando" });
    expect(r.error?.issues[0]?.message).toBe("Escolha o animal.");
  });

  it("retorno precisa de dia e hora válidos", () => {
    const ok = { ...atendimento, queixa: "Mancando" };
    expect(criarProntuarioSchema.safeParse({ ...ok, retorno: { data: "2026-10-02", hora: "09:30" } }).success).toBe(true);
    expect(criarProntuarioSchema.safeParse({ ...ok, retorno: { data: "2026-10-02", hora: "" } }).success).toBe(false);
  });

  it("remédio sem nome é recusado", () => {
    const r = criarProntuarioSchema.safeParse({ ...atendimento, remedios: [{ nome: " ", como: "2x ao dia" }] });
    expect(r.error?.issues[0]?.message).toBe("Diga o nome do remédio.");
  });
});
