import { temAlvo } from "@vocare/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { analisar } from "../../src/modulos/notas/ia/analisar";
import { ferramenta } from "../../src/modulos/notas/ia/ferramenta";
import { calendario, instrucoes, type AnimalParaIa } from "../../src/modulos/notas/ia/instrucoes";
import { nomeDito, normalizar } from "../../src/modulos/notas/ia/normalizar";
import { pareceFala, transcrever } from "../../src/modulos/notas/ia/transcrever";
import { LIMITE_VOCABULARIO, vocabulario } from "../../src/modulos/notas/ia/vocabulario";
import type { GalpaoParaIa } from "../../src/modulos/aviario";

// Sem chave nos testes: o provedor finge um Groq, e o fetch é trocado em cada caso.
vi.mock("../../src/modulos/notas/ia/provedor", () => ({
  transcricao: () => ({ baseUrl: "https://ia.teste", apiKey: "k", modelo: "whisper" }),
  interpretacao: () => ({ tipo: "openai", baseUrl: "https://ia.teste", apiKey: "k", modelo: "modelo" }),
}));
afterEach(() => vi.unstubAllGlobals());

const animal = (nome: string, especie: string, raca: string | null = null, numero: string | null = null): AnimalParaIa => ({
  id: `a-${nome}`,
  nome,
  numero,
  especie,
  raca,
  tutor: null,
});
const vazio = new Set<string>();

describe("calendário das instruções", () => {
  it("põe o dia da semana em cada data, de uma semana antes a duas depois", () => {
    const c = calendario("2026-11-10").split("\n");
    expect(c).toHaveLength(22);
    expect(c[0]).toBe("2026-11-03 terça");
    expect(c).toContain("2026-11-09 segunda (ontem)");
    expect(c).toContain("2026-11-10 terça (hoje)");
    expect(c).toContain("2026-11-11 quarta (amanhã)");
    expect(c).toContain("2026-11-13 sexta");
    expect(c.at(-1)).toBe("2026-11-24 terça");
  });

  it("vira o mês e o ano", () => {
    expect(calendario("2026-12-30", 0, 3).split("\n")).toEqual([
      "2026-12-30 quarta (hoje)",
      "2026-12-31 quinta (amanhã)",
      "2027-01-01 sexta",
      "2027-01-02 sábado",
    ]);
  });

  it("entra nas instruções, junto com o número do brinco dos animais", () => {
    const t = instrucoes("2026-11-10", [animal("Mimosa", "bovino", "Nelore", "32"), animal("", "suino", null, "45")], []);
    expect(t).toContain("2026-11-13 sexta");
    expect(t).toContain("- id=a-Mimosa · Mimosa (nº 32, Bovino, Nelore)");
    expect(t).toContain("- id=a- · nº 45 (Suíno)");
  });
});

describe("nome do animal a cadastrar", () => {
  it("descrição e raça não são nome", () => {
    expect(nomeDito("porco novo", null)).toBe("");
    expect(nomeDito("Uma vaca nova", null)).toBe("");
    expect(nomeDito("landrace", "Landrace")).toBe("");
    expect(nomeDito("um Large White", "Large White")).toBe("");
    expect(nomeDito("filhote macho", null)).toBe("");
    expect(nomeDito(null, null)).toBe("");
  });

  it("nome ou número dito fica como foi dito", () => {
    expect(nomeDito("Mimosa", "Nelore")).toBe("Mimosa");
    expect(nomeDito("Porca 3", null)).toBe("Porca 3");
    expect(nomeDito(" brinco 45 ", null)).toBe("brinco 45");
  });

  it("cadastro sem nome fica para quem confere escrever, com confiança baixa", () => {
    const bruta = { tipo: "cadastrar_animal", titulo: "", alvo: "porco novo", animalId: null, detalhe: "", trecho: "", confianca: 80, especie: "suino" };
    const sem = normalizar({ ...bruta, nome: "porco novo" }, vazio, vazio);
    expect(sem).toMatchObject({ tipo: "cadastrar_animal", nome: "", especie: "suino" });
    expect(sem!.confianca).toBeLessThanOrEqual(60);
    expect(temAlvo(sem!)).toBe(false);

    const com = normalizar({ ...bruta, nome: "Porca 3" }, vazio, vazio);
    expect(com).toMatchObject({ nome: "Porca 3", confianca: 80 });
    expect(temAlvo(com!)).toBe(true);
  });
});

describe("ferramenta", () => {
  it("todo campo que não é obrigatório aceita null (o Groq recusa a resposta inteira se não aceitar)", () => {
    for (const comAviario of [false, true]) {
      const item = ferramenta(comAviario).input_schema.properties.operacoes.items;
      const obrigatorios: readonly string[] = item.required;
      for (const [campo, def] of Object.entries(item.properties as Record<string, { type: string | readonly string[] }>)) {
        if (obrigatorios.includes(campo) || campo === "tipo") continue;
        expect(def.type, campo).toContain("null");
      }
    }
  });
});

describe("vocabulário da transcrição", () => {
  it("leva os nomes do cadastro e as raças e termos das espécies que a empresa tem", () => {
    const v = vocabulario([animal("Mimosa", "suino", "Landrace"), animal("Bolinha", "suino")], [{ id: "g", nome: "Baia da maternidade", animais: 3 }]);
    expect(v).toContain("Mimosa");
    expect(v).toContain("Bolinha");
    expect(v).toContain("Baia da maternidade");
    expect(v).toContain("Landrace");
    expect(v).toContain("leitão");
    expect(v).not.toContain("Nelore");
    expect(v.match(/Landrace/g)).toHaveLength(1);
  });

  it("número sozinho não entra (ele o Whisper já escreve certo)", () => {
    expect(vocabulario([animal("45", "bovino")])).not.toMatch(/\b45\b/);
  });

  it("galpão com lote traz o vocabulário do aviário", () => {
    const galpao: GalpaoParaIa = { instalacaoId: "g3", nome: "Galpão 3", loteId: "l7", loteCodigo: "L-07", semana: 31, femeas: 1, machos: 1 };
    const v = vocabulario([], [], [galpao]);
    expect(v).toContain("Galpão 3");
    expect(v).toContain("L-07");
    expect(v).toContain("Gumboro");
  });

  it("sem cadastro, vale o manejo de bovinos, suínos e aves", () => {
    const v = vocabulario([]);
    expect(v).toContain("Nelore");
    expect(v).toContain("Landrace");
    expect(v).toContain("Cobb");
  });

  it("muito animal não passa do limite nem tira as raças", () => {
    const muitos = Array.from({ length: 300 }, (_, i) => animal(`Animal${i}`, "bovino", "Nelore"));
    const v = vocabulario(muitos);
    expect(v.length).toBeLessThanOrEqual(LIMITE_VOCABULARIO);
    expect(v).toContain("Animal0");
    expect(v).toContain("Nelore");
    expect(v).toContain("Angus");
  });
});

describe("transcrição", () => {
  const vocab = vocabulario([animal("Mimosa", "suino", "Landrace")]);

  it("manda o vocabulário no prompt, com temperatura 0", async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ text: "A Mimosa pariu doze leitões." }));
    vi.stubGlobal("fetch", fetch);
    const texto = await transcrever(new File([new Uint8Array(10)], "a.wav", { type: "audio/wav" }), vocab);
    expect(texto).toBe("A Mimosa pariu doze leitões.");
    const form = fetch.mock.calls[0]![1].body as FormData;
    expect(form.get("prompt")).toBe(vocab);
    expect(form.get("temperature")).toBe("0");
    expect(form.get("language")).toBe("pt");
  });

  it("o eco do prompt (áudio sem fala) vira não entendido", () => {
    expect(pareceFala("Anotação de manejo dos animais.", vocab)).toBe(false);
    expect(pareceFala("Leitão, leitoa, leitegada", vocab)).toBe(false);
    expect(pareceFala("A Mimosa pariu doze leitões.", vocab)).toBe(true);
    // Uma ou duas palavras podem ter sido ditas mesmo.
    expect(pareceFala("Landrace.", vocab)).toBe(true);
  });
});

describe("interpretação fora do formato", () => {
  const recusada = () => new Response(JSON.stringify({ error: { message: "Tool call validation failed", code: "tool_use_failed" } }), { status: 400 });
  const certa = () =>
    Response.json({
      choices: [{ message: { tool_calls: [{ function: { name: "registrar_ocorrencia", arguments: JSON.stringify({ resumo: " Parto. ", operacoes: [] }) } }] } }],
    });

  it("tenta de novo uma vez", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(recusada()).mockResolvedValueOnce(certa());
    vi.stubGlobal("fetch", fetch);
    await expect(analisar("A Mimosa pariu.", "2026-11-10", [])).resolves.toEqual({ resumo: "Parto.", operacoes: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("errou de novo: desiste", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(recusada()).mockResolvedValueOnce(recusada()).mockResolvedValueOnce(certa());
    vi.stubGlobal("fetch", fetch);
    await expect(analisar("A Mimosa pariu.", "2026-11-10", [])).rejects.toThrow("IA falhou (400)");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("outro erro (limite, servidor fora) não repete: quem mandou tenta mais tarde", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("limite", { status: 429 })).mockResolvedValueOnce(certa());
    vi.stubGlobal("fetch", fetch);
    await expect(analisar("A Mimosa pariu.", "2026-11-10", [])).rejects.toThrow("IA falhou (429)");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
