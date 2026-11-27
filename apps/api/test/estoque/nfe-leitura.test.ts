import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { lerNfe } from "../../src/modulos/estoque/regras/nfe-leitura";

const fixture = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), "utf8");

describe("leitura do XML da NF-e", () => {
  it("lê cabeçalho, emitente, destinatário e itens", () => {
    const r = lerNfe(fixture("nfe-varios-itens.xml"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor).toMatchObject({
      chave: "35261199888777000166550010000012341000012345",
      numero: "1234",
      serie: "1",
      emissao: "2026-11-20",
      modelo: "55",
      emitente: { documento: "99888777000166", nome: "AGRO RACOES FICTICIA LTDA", telefone: "1633334444" },
      destinatario: { documento: "00011122233", nome: "GRANJA EXEMPLO" },
      valorTotal: 25035,
    });
    expect(r.valor.itens).toHaveLength(2);
    expect(r.valor.itens[0]).toMatchObject({ codigo: "RP25", descricao: "RACAO POSTURA SC 25KG", unidade: "SC", quantidade: 300, lotes: [] });
  });

  it("custo do item soma frete, seguro, outras, IPI e ICMS-ST e tira o desconto", () => {
    const r = lerNfe(fixture("nfe-varios-itens.xml"));
    if (!r.ok) throw new Error(r.erro);
    expect(r.valor.itens.map((i) => i.custoTotal)).toEqual([24000 + 300 - 100 + 50, 750 + 10 + 5 + 20]);
    expect(r.valor.itens[1]!.lotes).toEqual([{ lote: "LT-77", quantidade: 5, validade: "2027-08-31" }]);
  });

  it("um único det com dois rastro vira 1 item com 2 lotes", () => {
    const r = lerNfe(fixture("nfe-um-item-dois-lotes.xml"));
    if (!r.ok) throw new Error(r.erro);
    expect(r.valor.itens).toHaveLength(1);
    expect(r.valor.itens[0]!.lotes).toEqual([
      { lote: "A1", quantidade: 3, validade: "2027-05-31" },
      { lote: "B2", quantidade: 2, validade: "2027-09-30" },
    ]);
    expect(r.valor.destinatario).toEqual({ documento: "11222333000144", nome: "GRANJA EXEMPLO" });
  });

  it("NFC-e só com o <NFe>, sem protocolo, também lê", () => {
    const r = lerNfe(fixture("nfe-sem-protocolo.xml"));
    if (!r.ok) throw new Error(r.erro);
    expect(r.valor).toMatchObject({ modelo: "65", numero: "7777", emitente: { documento: "44455566677", telefone: null }, destinatario: { documento: null, nome: null } });
    expect(r.valor.itens[0]).toMatchObject({ codigo: "DESINF5", quantidade: 2, custoTotal: 90 });
  });

  it("texto qualquer, XML que não é NF-e e modelo não aceito dão 400", () => {
    const invalida = { ok: false, status: 400, erro: "Arquivo não é uma NF-e válida." };
    expect(lerNfe("isto não é xml")).toEqual(invalida);
    expect(lerNfe("<pedido><numero>1</numero></pedido>")).toEqual(invalida);
    expect(lerNfe("<NFe><infNFe")).toEqual(invalida);
    const cte = fixture("nfe-sem-protocolo.xml").replace("<mod>65</mod>", "<mod>57</mod>");
    expect(lerNfe(cte)).toEqual({ ok: false, status: 400, erro: "Só dá para importar NF-e (modelo 55) e NFC-e (modelo 65)." });
  });
});
