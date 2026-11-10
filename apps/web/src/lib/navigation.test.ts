import { describe, expect, it } from "vitest";

import { acharAtivo, MENU, menuVisivel, RODAPE, validarMenu, type ModuloMenu } from "./navigation";

describe("registro de módulos", () => {
  it("o menu não tem problema", () => expect(validarMenu([...MENU, ...RODAPE])).toEqual([]));

  it("acusa id repetido, em breve com href errado e id sem o prefixo do módulo", () => {
    const m: ModuloMenu = {
      id: "x",
      rotulo: "X",
      telas: [
        { id: "x.a", rotulo: "A", href: "/dashboard" },
        { id: "x.a", rotulo: "A2", href: "/notas" },
        { id: "x.b", rotulo: "B", href: "/notas", emBreve: true },
        { id: "y.c", rotulo: "C", href: "/notas" },
      ],
    };
    expect(validarMenu([m])).toHaveLength(3);
  });

  it.each([
    ["/animais/grupos", "animais", "animais.grupos"],
    ["/animais/abc-123", "animais", "animais.cadastro"],
    ["/animais", "animais", "animais.cadastro"],
    ["/aviario/lotes/l1", "aviario", "aviario.lotes"],
    ["/saude/agenda", "saude", "saude.agenda"],
    ["/notas", "notas", null],
    ["/dashboard", "inicio", null],
  ])("acharAtivo(%s)", (caminho, modulo, tela) => {
    const a = acharAtivo(caminho);
    expect(a?.modulo.id).toBe(modulo);
    expect(a?.tela?.id ?? null).toBe(tela);
  });

  it("página em breve acha módulo e tela pelo ?tela=", () => {
    expect(acharAtivo("/em-breve", "animais.especies")?.tela?.rotulo).toBe("Espécies");
    expect(acharAtivo("/em-breve", "estoque")?.modulo.rotulo).toBe("Estoque");
    expect(acharAtivo("/em-breve", "nada")).toBeNull();
  });

  it("endereço fora do menu", () => expect(acharAtivo("/perfil")).toBeNull());

  it("sem galpão, Aviário fica só com Galpões e Incubatório", () => {
    const av = menuVisivel(MENU, { temInstalacao: false }).find((m) => m.id === "aviario")!;
    expect(av.telas.map((t) => t.id)).toEqual(["aviario.galpoes", "aviario.incubatorio"]);
    const com = menuVisivel(MENU, { temInstalacao: true }).find((m) => m.id === "aviario")!;
    expect(com.telas.map((t) => t.id)).toEqual(["aviario.lotes", "aviario.galpoes", "aviario.incubatorio"]);
  });
});
