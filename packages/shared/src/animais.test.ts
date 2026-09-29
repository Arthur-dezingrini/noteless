import { describe, expect, it } from "vitest";

import { atualizarAnimalSchema, criarAnimalSchema, rotuloAnimal } from "./animais";

describe("rotuloAnimal", () => {
  it("junta número e nome", () => {
    expect(rotuloAnimal({ numero: "07", nome: "Thor" })).toBe("nº 07 Thor");
  });

  it("só o número", () => {
    expect(rotuloAnimal({ numero: "47", nome: null })).toBe("nº 47");
  });

  it("só o nome, sem espaços sobrando", () => {
    expect(rotuloAnimal({ nome: "  Mimosa " })).toBe("Mimosa");
  });

  it("nome em branco conta como sem nome", () => {
    expect(rotuloAnimal({ nome: "   " })).toBe("Sem nome");
    expect(rotuloAnimal({})).toBe("Sem nome");
  });
});

describe("criarAnimalSchema", () => {
  it("aceita só o nome e a espécie", () => {
    expect(criarAnimalSchema.safeParse({ nome: "Thor", especie: "cao" }).success).toBe(true);
  });

  it("aceita só o número e a espécie (gado sem nome)", () => {
    expect(criarAnimalSchema.safeParse({ numero: "132", especie: "bovino" }).success).toBe(true);
  });

  it("recusa sem nome e sem número, com a mensagem no campo nome", () => {
    const r = criarAnimalSchema.safeParse({ especie: "bovino" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      message: "Informe o nome ou o número do animal.",
      path: ["nome"],
    });
  });

  it("recusa espécie que não existe", () => {
    expect(criarAnimalSchema.safeParse({ nome: "Thor", especie: "dragao" }).success).toBe(false);
  });

  it("converte o peso digitado e recusa peso impossível", () => {
    expect(criarAnimalSchema.parse({ nome: "Thor", especie: "cao", pesoKg: "31.5" }).pesoKg).toBe(31.5);
    expect(criarAnimalSchema.safeParse({ nome: "Thor", especie: "cao", pesoKg: 0 }).success).toBe(false);
    expect(criarAnimalSchema.safeParse({ nome: "Mimosa", especie: "bovino", pesoKg: 6000 }).success).toBe(false);
  });

  it("recusa data de nascimento fora do formato AAAA-MM-DD", () => {
    expect(criarAnimalSchema.safeParse({ nome: "Thor", especie: "cao", nascimento: "18/07/2022" }).success).toBe(false);
  });
});

describe("atualizarAnimalSchema", () => {
  it("exige a situação", () => {
    expect(atualizarAnimalSchema.safeParse({ nome: "Thor", especie: "cao" }).success).toBe(false);
    expect(atualizarAnimalSchema.safeParse({ nome: "Thor", especie: "cao", status: "inativo" }).success).toBe(true);
  });
});
