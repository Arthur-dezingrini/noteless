import { readFileSync } from "node:fs";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../../src/db";
import { entrada, produtoFornecedor } from "../../src/db/tabelas/estoque";
import { chamar, criarFazenda } from "../ajuda";

const fixture = (nome: string) => readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), "utf8");
const VARIOS = fixture("nfe-varios-itens.xml");
const DOIS_LOTES = fixture("nfe-um-item-dois-lotes.xml");
let n = 0;

async function granja() {
  n += 1;
  const f = await criarFazenda(`NFe ${n}`);
  const base = `/api/org/${f.orgId}/estoque`;
  const post = async (caminho: string, corpo: unknown) => (await chamar(f.dono, "POST", `${base}/${caminho}`, corpo)).json;
  const racao = await post("produtos", { nome: "Ração postura", categoria: "racao", unidade: "kg" });
  const vacina = await post("produtos", { nome: "Newcastle", categoria: "vacina", unidade: "dose" });
  const silo = await post("locais", { nome: "Silo", tipo: "silo" });
  const geladeira = await post("locais", { nome: "Geladeira", tipo: "geladeira" });
  const confirmarVarios = () =>
    chamar(f.membro, "POST", `${base}/nfe/confirmar`, {
      xml: VARIOS,
      itens: [
        { indice: 0, produtoId: racao.id, fator: 25, localId: silo.id },
        { indice: 1, produtoId: vacina.id, fator: 1000, localId: geladeira.id },
      ],
    });
  return { f, base, racao, vacina, silo, geladeira, confirmarVarios };
}

describe("importar NF-e", () => {
  it("ler devolve a nota sem gravar nada", async () => {
    const g = await granja();
    const r = await chamar(g.f.membro, "POST", `${g.base}/nfe/ler`, { xml: VARIOS });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ chave: "35261199888777000166550010000012341000012345", fornecedor: null, sugestoes: [null, null] });
    expect(r.json.itens).toHaveLength(2);
    expect(await db.select().from(entrada).where(eq(entrada.organizationId, g.f.orgId))).toHaveLength(0);
  });

  it("confirmar cria fornecedor, entrada, movimentos com custo e lote, e o vínculo", async () => {
    const g = await granja();
    const r = await g.confirmarVarios();
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({
      origem: "nfe",
      numeroNota: "1234",
      serie: "1",
      chaveNfe: "35261199888777000166550010000012341000012345",
      dataEmissao: "2026-11-20",
      valorTotal: 25035,
      fornecedorNome: "AGRO RACOES FICTICIA LTDA",
    });
    const porProduto = Object.fromEntries(r.json.itens.map((i: { produtoNome: string }) => [i.produtoNome, i]));
    expect(porProduto["Ração postura"]).toMatchObject({ quantidade: 7500, custoUnitario: 3.2333, loteFabricacao: "", localNome: "Silo" });
    expect(porProduto["Newcastle"]).toMatchObject({ quantidade: 5000, custoUnitario: 0.157, loteFabricacao: "LT-77", validade: "2027-08-31" });

    const vinculos = await db.select().from(produtoFornecedor).where(eq(produtoFornecedor.organizationId, g.f.orgId));
    expect(vinculos.map((v) => [v.codigo, v.unidadeCompra, Number(v.fator)]).sort()).toEqual([
      ["RP25", "SC", 25],
      ["VNC1000", "FR", 1000],
    ]);
    const fornecedores = (await chamar(g.f.dono, "GET", `${g.base}/fornecedores`)).json;
    expect(fornecedores).toEqual([expect.objectContaining({ nome: "AGRO RACOES FICTICIA LTDA", documento: "99888777000166", telefone: "1633334444" })]);
  });

  it("a segunda nota do mesmo fornecedor já vem ligada e os lotes da nota viram movimentos", async () => {
    const g = await granja();
    await g.confirmarVarios();
    const lida = await chamar(g.f.dono, "POST", `${g.base}/nfe/ler`, { xml: DOIS_LOTES });
    expect(lida.json.fornecedor).toMatchObject({ nome: "AGRO RACOES FICTICIA LTDA" });
    expect(lida.json.sugestoes).toEqual([{ produtoId: g.vacina.id, fator: 1000, localId: g.geladeira.id }]);

    const r = await chamar(g.f.dono, "POST", `${g.base}/nfe/confirmar`, {
      xml: DOIS_LOTES,
      itens: [{ indice: 0, produtoId: g.vacina.id, fator: 1000, localId: g.geladeira.id }],
    });
    expect(r.status).toBe(201);
    expect(r.json.itens.map((i: { loteFabricacao: string; quantidade: number }) => [i.loteFabricacao, i.quantidade]).sort()).toEqual([
      ["A1", 3000],
      ["B2", 2000],
    ]);
    expect((await chamar(g.f.dono, "GET", `${g.base}/fornecedores`)).json).toHaveLength(1);
  });

  it("a mesma nota dá 409 no ler e no confirmar", async () => {
    const g = await granja();
    expect((await g.confirmarVarios()).status).toBe(201);
    const erro = { status: 409, json: { error: "Esta NF-e já foi importada." } };
    expect(await chamar(g.f.dono, "POST", `${g.base}/nfe/ler`, { xml: VARIOS })).toMatchObject(erro);
    expect(await g.confirmarVarios()).toMatchObject(erro);
  });

  it("produto que exige lote sem lote na nota nem na tela dá 400", async () => {
    const g = await granja();
    const r = await chamar(g.f.dono, "POST", `${g.base}/nfe/confirmar`, {
      xml: fixture("nfe-sem-protocolo.xml"),
      itens: [{ indice: 0, produtoId: g.vacina.id, fator: 1, localId: g.geladeira.id }],
    });
    expect(r).toMatchObject({ status: 400, json: { error: "Informe o lote e a validade de DESINFETANTE 5L." } });
    expect(await db.select().from(entrada).where(eq(entrada.organizationId, g.f.orgId))).toHaveLength(0);
  });

  it("outra fazenda 403; XML acima de 1 MB 413; arquivo que não é NF-e 400", async () => {
    const g = await granja();
    const fora = await criarFazenda(`NFe fora ${n}`);
    expect((await chamar(fora.dono, "POST", `${g.base}/nfe/ler`, { xml: VARIOS })).status).toBe(403);
    expect((await chamar(fora.dono, "POST", `${g.base}/nfe/confirmar`, { xml: VARIOS, itens: [] })).status).toBe(403);
    const grande = VARIOS.replace("<natOp>VENDA</natOp>", `<natOp>${"x".repeat(1_100_000)}</natOp>`);
    expect(await chamar(g.f.dono, "POST", `${g.base}/nfe/ler`, { xml: grande })).toMatchObject({ status: 413, json: { error: "O XML passa de 1 MB." } });
    expect(await chamar(g.f.dono, "POST", `${g.base}/nfe/ler`, { xml: "<pedido/>" })).toMatchObject({ status: 400, json: { error: "Arquivo não é uma NF-e válida." } });
  });
});
