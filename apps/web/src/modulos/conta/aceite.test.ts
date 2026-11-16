import { VERSAO_TERMOS } from "@vocare/shared";
import { describe, expect, it } from "vitest";

import { precisaAceitar, versaoParaAceitar } from "./aceite";

describe("quem é levado ao aceite dos termos", () => {
  it("termos fora de vigor: ninguém é levado ao aceite", () => {
    expect(precisaAceitar({ versao: VERSAO_TERMOS, aceitoEm: null }, false)).toBe(false);
  });

  it("em vigor e sem aceite: vai para o aceite", () => {
    expect(precisaAceitar({ versao: VERSAO_TERMOS, aceitoEm: null }, true)).toBe(true);
  });

  it("em vigor e já aceito: segue", () => {
    expect(precisaAceitar({ versao: VERSAO_TERMOS, aceitoEm: new Date() }, true)).toBe(false);
  });

  it("a api falhou ao consultar: não tranca ninguém", () => {
    expect(precisaAceitar(null, true)).toBe(false);
  });

  it("o aceite vai com a versão que a api pediu, mesmo se o web estiver noutra versão", () => {
    expect(versaoParaAceitar({ versao: "2027-01-10", aceitoEm: null })).toBe("2027-01-10");
  });

  it("sem resposta da api, vai a versão do web", () => {
    expect(versaoParaAceitar(null)).toBe(VERSAO_TERMOS);
  });
});
