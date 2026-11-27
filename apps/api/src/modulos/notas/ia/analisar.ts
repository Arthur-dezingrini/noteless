import { type Operacao } from "@vocare/shared";
import { z } from "zod";

import type { GalpaoParaIa } from "../../aviario";
import type { EstoqueParaIa } from "../../estoque";
import { transcricaoCorrigida } from "./correcao";
import { ferramenta, type Ferramenta } from "./ferramenta";
import { instrucoes, type AnimalParaIa, type GrupoParaIa } from "./instrucoes";
import { normalizar } from "./normalizar";
import { interpretacao, type Interpretacao } from "./provedor";
import { IaNaoConfigurada } from "./transcrever";

export type Analise = {
  /** A transcrição com as palavras mal ouvidas corrigidas; null = fica a do Whisper. */
  transcricao: string | null;
  resumo: string;
  operacoes: Operacao[];
};

/** Forma solta do que o modelo devolve; a normalização aperta. */
const saidaSchema = z.object({
  transcricaoCorrigida: z.string().nullish(),
  resumo: z.string(),
  operacoes: z.array(z.record(z.string(), z.unknown())),
});

/**
 * A resposta não veio no formato da ferramenta (o Groq recusa com 400
 * "tool_use_failed" quando falta um campo obrigatório). O modelo não erra
 * sempre do mesmo jeito: vale uma segunda tentativa.
 */
class ForaDoFormato extends Error {}

const TENTATIVAS = 2;

function mensagemUsuario(transcricao: string) {
  return `Transcrição do áudio:\n"""${transcricao}"""`;
}

async function lerErro(res: Response) {
  const corpo = await res.text().catch(() => "");
  const msg = `IA falhou (${res.status}): ${corpo.slice(0, 300)}`;
  return res.status === 400 && corpo.includes("tool_use_failed") ? new ForaDoFormato(msg) : new Error(msg);
}

/** Claude: a ferramenta vai como `tool` e a resposta vem num bloco `tool_use`. */
async function chamarAnthropic(cfg: Extract<Interpretacao, { tipo: "anthropic" }>, sistema: string, transcricao: string, ferr: Ferramenta) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelo,
      max_tokens: 3000,
      system: sistema,
      tools: [ferr],
      tool_choice: { type: "tool", name: ferr.name },
      messages: [{ role: "user", content: mensagemUsuario(transcricao) }],
    }),
  });
  if (!res.ok) throw await lerErro(res);

  const msg = (await res.json()) as { content: Array<{ type: string; name?: string; input?: unknown }> };
  return msg.content.find((b) => b.type === "tool_use" && b.name === ferr.name)?.input;
}

/**
 * API compatível com a OpenAI (Groq e afins): a mesma ferramenta vira uma
 * `function`, e os argumentos voltam como string JSON em `tool_calls`.
 */
async function chamarOpenAi(cfg: Extract<Interpretacao, { tipo: "openai" }>, sistema: string, transcricao: string, ferr: Ferramenta) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelo,
      max_tokens: 3000,
      temperature: 0.2,
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: mensagemUsuario(transcricao) },
      ],
      tools: [
        {
          type: "function",
          function: { name: ferr.name, description: ferr.description, parameters: ferr.input_schema },
        },
      ],
      tool_choice: { type: "function", function: { name: ferr.name } },
    }),
  });
  if (!res.ok) throw await lerErro(res);

  const msg = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
  };
  const chamada = msg.choices?.[0]?.message?.tool_calls?.find((t) => t.function?.name === ferr.name);
  if (!chamada?.function?.arguments) return undefined;
  try {
    return JSON.parse(chamada.function.arguments) as unknown;
  } catch {
    return undefined;
  }
}

/** Transcrição + contexto da organização → resumo e operações propostas. */
export async function analisar(
  transcricao: string,
  hoje: string,
  animais: AnimalParaIa[],
  grupos: GrupoParaIa[] = [],
  galpoes: GalpaoParaIa[] = [],
  estoque: EstoqueParaIa = { produtos: [], locais: [] },
): Promise<Analise> {
  const cfg = interpretacao();
  if (!cfg) throw new IaNaoConfigurada("A interpretação por IA (GROQ_API_KEY)");

  const sistema = instrucoes(hoje, animais, grupos, galpoes, estoque);
  const ferr = ferramenta(galpoes.length > 0, estoque.produtos.length > 0);
  const idsAnimais = new Set(animais.map((a) => a.id));
  const idsGrupos = new Set(grupos.map((g) => g.id));

  for (let tentativa = 1; ; tentativa++) {
    try {
      const bruto =
        cfg.tipo === "anthropic"
          ? await chamarAnthropic(cfg, sistema, transcricao, ferr)
          : await chamarOpenAi(cfg, sistema, transcricao, ferr);
      const saida = saidaSchema.safeParse(bruto);
      if (!saida.success) throw new ForaDoFormato("A IA respondeu fora do formato esperado.");
      return {
        transcricao: transcricaoCorrigida(transcricao, saida.data.transcricaoCorrigida),
        resumo: saida.data.resumo.trim(),
        operacoes: saida.data.operacoes
          .map((op) => normalizar(op, idsAnimais, idsGrupos, galpoes, estoque))
          .filter((op): op is Operacao => op !== null),
      };
    } catch (e) {
      if (!(e instanceof ForaDoFormato) || tentativa >= TENTATIVAS) throw e;
    }
  }
}
