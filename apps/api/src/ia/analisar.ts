import {
  ROTULO_ESPECIE,
  ROTULO_TIPO_CONSULTA,
  TIPOS_CONSULTA,
  operacaoSchema,
  type Operacao,
} from "@vocare/shared";
import { z } from "zod";

import { interpretacao, type Interpretacao } from "./provedor";
import { IaNaoConfigurada } from "./transcrever";

export type AnimalParaIa = {
  id: string;
  nome: string;
  especie: string;
  raca: string | null;
  tutor: string | null;
};

export type Analise = {
  resumo: string;
  operacoes: Operacao[];
};

/**
 * O modelo devolve a análise chamando esta "ferramenta" — é o jeito de
 * receber JSON com forma garantida em vez de texto para fazer parse.
 */
const FERRAMENTA = {
  name: "registrar_ocorrencia",
  description:
    "Registra a interpretação de um áudio do campo: resumo e lista de operações propostas para o revisor humano confirmar.",
  input_schema: {
    type: "object",
    properties: {
      resumo: {
        type: "string",
        description: "Uma frase, em português, resumindo o que o operador relatou.",
      },
      operacoes: {
        type: "array",
        description:
          "Operações que o sistema deveria executar por causa do relato. Vazio se o áudio não pede nenhuma ação.",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["agendar_consulta", "registrar_anotacao", "registrar_peso"] },
            titulo: { type: "string", description: "Rótulo curto da operação, ex.: 'Registrar pesagem'." },
            alvo: { type: "string", description: "Como o operador se referiu ao animal, ex.: 'Thor', 'brinco 3'." },
            animalId: {
              type: ["string", "null"],
              description: "id do animal na lista de cadastrados que corresponde ao alvo; null se nenhum bate.",
            },
            detalhe: { type: "string", description: "O que será registrado, em uma linha." },
            confianca: { type: "integer", minimum: 0, maximum: 100 },
            trecho: { type: "string", description: "Trecho literal da transcrição que justifica a operação." },
            data: { type: ["string", "null"], description: "agendar_consulta: AAAA-MM-DD, ou null se não foi dito." },
            hora: { type: ["string", "null"], description: "agendar_consulta: HH:MM, ou null se não foi dito." },
            tipoConsulta: { type: "string", enum: [...TIPOS_CONSULTA], description: "agendar_consulta." },
            observacoes: { type: ["string", "null"], description: "agendar_consulta: motivo/queixa." },
            texto: { type: "string", description: "registrar_anotacao: a anotação clínica." },
            pesoKg: { type: "number", description: "registrar_peso: peso em kg." },
          },
          required: ["tipo", "titulo", "alvo", "animalId", "detalhe", "confianca", "trecho"],
        },
      },
    },
    required: ["resumo", "operacoes"],
  },
} as const;

function instrucoes(hoje: string, animais: AnimalParaIa[]) {
  const lista = animais.length
    ? animais
        .map(
          (a) =>
            `- id=${a.id} · ${a.nome} (${ROTULO_ESPECIE[a.especie as keyof typeof ROTULO_ESPECIE] ?? a.especie}${a.raca ? `, ${a.raca}` : ""}${a.tutor ? `, tutor ${a.tutor}` : ""})`,
        )
        .join("\n")
    : "(nenhum animal cadastrado)";

  const tipos = TIPOS_CONSULTA.map((t) => `${t} = ${ROTULO_TIPO_CONSULTA[t]}`).join("; ");

  return `Você interpreta áudios curtos gravados por operadores de uma clínica veterinária / fazenda, já transcritos, e propõe o que o sistema de gestão deve registrar. Um humano vai revisar e confirmar cada operação — seu papel é propor, com honestidade sobre a confiança.

Hoje é ${hoje} (fuso de São Paulo). Datas relativas ("amanhã", "sexta", "daqui a três dias") devem virar AAAA-MM-DD a partir de hoje.

Animais cadastrados nesta organização:
${lista}

Regras:
- Ligue cada operação a um animal da lista pelo id quando o nome/apelido/brinco bater com razoável certeza. Se não bater, animalId = null e confiança baixa.
- Transcrição é falha: "pesa quatrocentos e doze" pode vir como "412" ou "4 12". Interprete com bom senso e cite o trecho literal.
- Tipos de operação: agendar_consulta (marcar atendimento; tipos: ${tipos}), registrar_anotacao (observação clínica ou de manejo sobre um animal), registrar_peso (pesagem).
- Uma frase pode gerar mais de uma operação; uma operação por fato relatado. Não invente fatos que não foram ditos.
- confianca: 90+ quando tudo está explícito e o animal foi identificado; 70–89 quando há uma inferência pequena; abaixo de 70 quando há ambiguidade real (animal incerto, número duvidoso).
- Escreva em português do Brasil, curto e objetivo.`;
}

/** Forma solta do que o modelo devolve; a normalização abaixo aperta. */
const saidaSchema = z.object({
  resumo: z.string(),
  operacoes: z.array(z.record(z.string(), z.unknown())),
});

/**
 * O modelo pode chutar id, mandar 95.7 de confiança ou esquecer um campo.
 * Aqui tudo vira uma `Operacao` válida ou é descartado — a tela nunca vê
 * dado fora do contrato.
 */
function normalizar(bruta: Record<string, unknown>, idsValidos: Set<string>): Operacao | null {
  const animalId = typeof bruta.animalId === "string" && idsValidos.has(bruta.animalId) ? bruta.animalId : null;
  const confianca = Math.max(0, Math.min(100, Math.round(Number(bruta.confianca) || 0)));
  const base = {
    titulo: String(bruta.titulo ?? ""),
    alvo: String(bruta.alvo ?? ""),
    animalId,
    detalhe: String(bruta.detalhe ?? ""),
    // Sem animal do cadastro, a operação não é aplicável — e o revisor tem
    // que ver isso, por mais certo que o modelo esteja do resto.
    confianca: animalId ? confianca : Math.min(confianca, 60),
    trecho: String(bruta.trecho ?? ""),
  };

  let candidata: unknown;
  switch (bruta.tipo) {
    case "agendar_consulta":
      candidata = {
        ...base,
        tipo: "agendar_consulta",
        data: bruta.data ?? null,
        hora: bruta.hora ?? null,
        tipoConsulta: bruta.tipoConsulta ?? "consulta",
        observacoes: bruta.observacoes ?? null,
      };
      break;
    case "registrar_anotacao":
      candidata = { ...base, tipo: "registrar_anotacao", texto: bruta.texto ?? base.detalhe };
      break;
    case "registrar_peso":
      candidata = { ...base, tipo: "registrar_peso", pesoKg: Number(bruta.pesoKg) };
      break;
    default:
      return null;
  }

  const parsed = operacaoSchema.safeParse(candidata);
  return parsed.success ? parsed.data : null;
}

function mensagemUsuario(transcricao: string) {
  return `Transcrição do áudio:\n"""${transcricao}"""`;
}

async function lerErro(res: Response) {
  const corpo = await res.text().catch(() => "");
  return new Error(`IA falhou (${res.status}): ${corpo.slice(0, 300)}`);
}

/** Claude: a ferramenta vai como `tool` e a resposta vem num bloco `tool_use`. */
async function chamarAnthropic(cfg: Extract<Interpretacao, { tipo: "anthropic" }>, sistema: string, transcricao: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelo,
      max_tokens: 2048,
      system: sistema,
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: FERRAMENTA.name },
      messages: [{ role: "user", content: mensagemUsuario(transcricao) }],
    }),
  });
  if (!res.ok) throw await lerErro(res);

  const msg = (await res.json()) as { content: Array<{ type: string; name?: string; input?: unknown }> };
  return msg.content.find((b) => b.type === "tool_use" && b.name === FERRAMENTA.name)?.input;
}

/**
 * API compatível com a OpenAI (Groq e afins): a mesma ferramenta vira uma
 * `function`, e os argumentos voltam como string JSON em `tool_calls`.
 */
async function chamarOpenAi(cfg: Extract<Interpretacao, { tipo: "openai" }>, sistema: string, transcricao: string) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.modelo,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: mensagemUsuario(transcricao) },
      ],
      tools: [
        {
          type: "function",
          function: { name: FERRAMENTA.name, description: FERRAMENTA.description, parameters: FERRAMENTA.input_schema },
        },
      ],
      tool_choice: { type: "function", function: { name: FERRAMENTA.name } },
    }),
  });
  if (!res.ok) throw await lerErro(res);

  const msg = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
  };
  const chamada = msg.choices?.[0]?.message?.tool_calls?.find((t) => t.function?.name === FERRAMENTA.name);
  if (!chamada?.function?.arguments) return undefined;
  try {
    return JSON.parse(chamada.function.arguments) as unknown;
  } catch {
    return undefined;
  }
}

/** Transcrição + contexto da organização → resumo e operações propostas. */
export async function analisar(transcricao: string, hoje: string, animais: AnimalParaIa[]): Promise<Analise> {
  const cfg = interpretacao();
  if (!cfg) throw new IaNaoConfigurada("A interpretação por IA (GROQ_API_KEY)");

  const sistema = instrucoes(hoje, animais);
  const bruto =
    cfg.tipo === "anthropic"
      ? await chamarAnthropic(cfg, sistema, transcricao)
      : await chamarOpenAi(cfg, sistema, transcricao);

  const saida = saidaSchema.safeParse(bruto);
  if (!saida.success) throw new Error("A IA respondeu fora do formato esperado.");

  const idsValidos = new Set(animais.map((a) => a.id));
  return {
    resumo: saida.data.resumo.trim(),
    operacoes: saida.data.operacoes
      .map((op) => normalizar(op, idsValidos))
      .filter((op): op is Operacao => op !== null),
  };
}
