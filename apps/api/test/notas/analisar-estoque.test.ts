import { describe, expect, it } from "vitest";

import type { EstoqueParaIa } from "../../src/modulos/estoque";
import { ferramenta } from "../../src/modulos/notas/ia/ferramenta";
import { instrucoes } from "../../src/modulos/notas/ia/instrucoes";
import { normalizar } from "../../src/modulos/notas/ia/normalizar";

const estoque: EstoqueParaIa = {
  produtos: [
    { id: "p1", nome: "Ração Postura", categoria: "racao", unidade: "kg", embalagemNome: "saco", embalagemFator: 25 },
    { id: "v1", nome: "Newcastle", categoria: "vacina", unidade: "dose", embalagemNome: "frasco", embalagemFator: 1000 },
    { id: "d1", nome: "Desinfetante", categoria: "material", unidade: "l", embalagemNome: null, embalagemFator: null },
  ],
  locais: [
    { id: "l1", nome: "Silo 2" },
    { id: "l2", nome: "Geladeira" },
  ],
};
const vazio = new Set<string>();
const tipos = (f: ReturnType<typeof ferramenta>) => [...f.input_schema.properties.operacoes.items.properties.tipo.enum];
const bruta = { titulo: "Entrada", alvo: "ração", animalId: null, confianca: 90, trecho: "chegaram" };

describe("a IA e o estoque", () => {
  it("a ferramenta só traz as operações de estoque quando a organização tem produto", () => {
    expect(tipos(ferramenta(false, true))).toEqual(expect.arrayContaining(["entrada_estoque", "saida_estoque"]));
    expect(tipos(ferramenta(false))).not.toContain("entrada_estoque");
    expect(tipos(ferramenta(true, true))).toEqual(expect.arrayContaining(["apontar_galpao", "entrada_estoque"]));
  });

  it("as instruções listam produtos e locais com id", () => {
    const t = instrucoes("2026-11-27", [], [], [], estoque);
    expect(t).toContain("id=p1 · Ração Postura");
    expect(t).toContain("id=l1 · Silo 2");
    expect(t).toContain("entrada_estoque");
    expect(instrucoes("2026-11-27", [], [])).not.toContain("entrada_estoque");
  });

  it("reconhece produto e local pelo nome sem acento e converte sacos em kg", () => {
    const op = normalizar(
      { ...bruta, tipo: "entrada_estoque", produto: "racao postura", produtoId: "chute", local: "silo 2", quantidade: 300, unidade: "sacos", fornecedor: "Agro X" },
      vazio,
      vazio,
      [],
      estoque,
    );
    expect(op).toMatchObject({ tipo: "entrada_estoque", produtoId: "p1", localId: "l1", quantidade: 7500, unidade: "kg", fornecedor: "Agro X", confianca: 90 });
  });

  it("toneladas viram kg e frasco vira doses", () => {
    expect(normalizar({ ...bruta, tipo: "entrada_estoque", produto: "ração", local: "silo", quantidade: 2, unidade: "toneladas" }, vazio, vazio, [], estoque)).toMatchObject({
      produtoId: "p1",
      localId: "l1",
      quantidade: 2000,
    });
    expect(normalizar({ ...bruta, tipo: "saida_estoque", produtoId: "v1", localId: "l2", quantidade: 1, unidade: "frasco" }, vazio, vazio, [], estoque)).toMatchObject({
      produtoId: "v1",
      quantidade: 1000,
      unidade: "dose",
    });
  });

  it("produto que não está no cadastro fica para quem confere, com confiança baixa", () => {
    const op = normalizar({ ...bruta, tipo: "entrada_estoque", produto: "milho", local: "silo 2", quantidade: 10, unidade: "kg" }, vazio, vazio, [], estoque);
    expect(op).toMatchObject({ produtoId: null, localId: "l1", quantidade: 10 });
    expect(op!.confianca).toBeLessThanOrEqual(60);
  });

  it("vacina e remédio da nota reconhecem o produto do estoque, só da categoria certa", () => {
    const animal = new Set(["a1"]);
    const vac = normalizar({ ...bruta, tipo: "aplicar_vacina", animalId: "a1", vacina: "newcastle", data: null }, animal, vazio, [], estoque);
    expect(vac).toMatchObject({ produtoId: "v1" });
    const errado = normalizar({ ...bruta, tipo: "aplicar_vacina", animalId: "a1", vacina: "ração postura", data: null }, animal, vazio, [], estoque);
    expect(errado).toMatchObject({ produtoId: null });
    const semEstoque = normalizar({ ...bruta, tipo: "aplicar_vacina", animalId: "a1", vacina: "newcastle", data: null }, animal, vazio);
    expect(semEstoque && "produtoId" in semEstoque ? semEstoque.produtoId : undefined).toBeUndefined();
  });

  it("sem produto no estoque, operação de estoque é descartada", () => {
    expect(normalizar({ ...bruta, tipo: "entrada_estoque", produto: "ração", quantidade: 1 }, vazio, vazio, [], { produtos: [], locais: [] })).toBeNull();
  });
});
