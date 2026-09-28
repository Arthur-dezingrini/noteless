import {
  ESPECIES,
  ROTULO_ESPECIE,
  ROTULO_TIPO_CONSULTA,
  SEXOS,
  TIPOS_COM_GRUPO,
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

export type GrupoParaIa = { id: string; nome: string; animais: number };

export type Analise = {
  resumo: string;
  operacoes: Operacao[];
};

const TIPOS_OPERACAO = [
  "agendar_consulta",
  "registrar_anotacao",
  "registrar_peso",
  "aplicar_vacina",
  "registrar_remedio",
  "registrar_parto",
  "cadastrar_animal",
] as const;

const textoOuNulo = (description: string) => ({ type: ["string", "null"], description });
const inteiroOuNulo = (description: string) => ({ type: ["integer", "null"], description });

/**
 * O modelo devolve a análise chamando esta "ferramenta" — é o jeito de
 * receber JSON com forma garantida em vez de texto para fazer parse. Os
 * campos específicos de cada tipo ficam todos no mesmo objeto; a
 * normalização abaixo pega só os que o tipo usa.
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
            tipo: { type: "string", enum: [...TIPOS_OPERACAO] },
            titulo: { type: "string", description: "Rótulo curto da operação, ex.: 'Registrar pesagem'." },
            alvo: {
              type: "string",
              description: "Como o operador se referiu ao animal ou grupo, ex.: 'Thor', 'brinco 3', 'lote dos bezerros'.",
            },
            animalId: textoOuNulo("id do animal da lista que corresponde ao alvo; null se nenhum bate ou se o alvo é um grupo."),
            grupoId: textoOuNulo("id do grupo da lista, quando a operação vale para o grupo inteiro; senão null."),
            detalhe: { type: "string", description: "O que será registrado, em uma linha." },
            confianca: { type: "integer", minimum: 0, maximum: 100 },
            trecho: { type: "string", description: "Trecho literal da transcrição que justifica a operação." },
            data: textoOuNulo("AAAA-MM-DD: dia da consulta, da vacina ou do parto; null se não foi dito."),
            hora: textoOuNulo("agendar_consulta: HH:MM, ou null se não foi dito."),
            tipoConsulta: { type: "string", enum: [...TIPOS_CONSULTA], description: "agendar_consulta." },
            observacoes: textoOuNulo("agendar_consulta/registrar_parto: observações."),
            texto: { type: "string", description: "registrar_anotacao: a anotação clínica ou de manejo." },
            pesoKg: { type: "number", description: "registrar_peso: peso em kg." },
            vacina: { type: "string", description: "aplicar_vacina: nome da vacina (ex.: 'aftosa', 'V10', 'antirrábica')." },
            dose: textoOuNulo("aplicar_vacina/registrar_remedio: dose ('2ª dose', '5 ml')."),
            proximaData: textoOuNulo("aplicar_vacina: AAAA-MM-DD da próxima dose/reforço, se foi dito."),
            remedio: { type: "string", description: "registrar_remedio: nome do remédio." },
            dias: inteiroOuNulo("registrar_remedio: por quantos dias, a partir de hoje."),
            carenciaDias: inteiroOuNulo("registrar_remedio: carência em dias, se foi dita."),
            crias: inteiroOuNulo("registrar_parto: quantas crias nasceram."),
            nome: { type: "string", description: "cadastrar_animal: nome ou identificação do animal novo." },
            especie: { type: "string", enum: [...ESPECIES], description: "cadastrar_animal." },
            raca: textoOuNulo("cadastrar_animal: raça."),
            sexo: { type: ["string", "null"], enum: [...SEXOS, null], description: "cadastrar_animal." },
            nascimento: textoOuNulo("cadastrar_animal: AAAA-MM-DD de nascimento (hoje, se nasceu agora)."),
          },
          required: ["tipo", "titulo", "alvo", "animalId", "detalhe", "confianca", "trecho"],
        },
      },
    },
    required: ["resumo", "operacoes"],
  },
} as const;

function instrucoes(hoje: string, animais: AnimalParaIa[], grupos: GrupoParaIa[]) {
  const listaAnimais = animais.length
    ? animais
        .map(
          (a) =>
            `- id=${a.id} · ${a.nome} (${ROTULO_ESPECIE[a.especie as keyof typeof ROTULO_ESPECIE] ?? a.especie}${a.raca ? `, ${a.raca}` : ""}${a.tutor ? `, tutor ${a.tutor}` : ""})`,
        )
        .join("\n")
    : "(nenhum animal cadastrado)";
  const listaGrupos = grupos.length
    ? grupos.map((g) => `- id=${g.id} · ${g.nome} (${g.animais} animais)`).join("\n")
    : "(nenhum grupo)";

  const tipos = TIPOS_CONSULTA.map((t) => `${t} = ${ROTULO_TIPO_CONSULTA[t]}`).join("; ");

  return `Você interpreta áudios curtos gravados por quem cuida de animais — numa fazenda, sítio, clínica veterinária ou em casa —, já transcritos, e propõe o que o sistema de gestão deve registrar. Um humano vai revisar e confirmar cada operação — seu papel é propor, com honestidade sobre a confiança.

Hoje é ${hoje} (fuso de São Paulo). Datas relativas ("amanhã", "sexta", "daqui a três dias", "daqui a 30 dias") devem virar AAAA-MM-DD a partir de hoje.

Animais cadastrados:
${listaAnimais}

Grupos de animais:
${listaGrupos}

Tipos de operação:
- agendar_consulta: marcar atendimento futuro (tipos: ${tipos}).
- registrar_peso: pesagem.
- aplicar_vacina: vacina aplicada (nome, dose, data; próxima dose se dita).
- registrar_remedio: remédio/tratamento iniciado (nome, dose, por quantos dias, carência).
- registrar_parto: um animal da lista pariu (mãe = animalId; data; quantas crias).
- cadastrar_animal: um animal NOVO, que não está na lista (nome, espécie, sexo, raça, nascimento). animalId = null.
- registrar_anotacao: qualquer outra observação clínica ou de manejo sobre um animal.

Regras:
- Ligue cada operação a um animal da lista pelo id quando nome/apelido/brinco bater com razoável certeza. Se não bater, animalId = null e confiança baixa.
- Se o operador fala de um grupo inteiro ("o lote", "os bezerros", "a baia 2") e ele está na lista de grupos, use grupoId (e animalId = null). Só ${TIPOS_COM_GRUPO.join(", ")} aceitam grupo.
- Nasceu um filhote: registrar_parto na mãe e, se o filhote tiver nome ou for para cadastro, cadastrar_animal.
- Transcrição é falha: "pesa quatrocentos e doze" pode vir como "412" ou "4 12". Interprete com bom senso e cite o trecho literal.
- Uma frase pode gerar mais de uma operação; uma operação por fato relatado. Não invente fatos que não foram ditos; campo não dito = null.
- confianca: 90+ quando tudo está explícito e o alvo foi identificado; 70–89 quando há uma inferência pequena; abaixo de 70 quando há ambiguidade real.
- Escreva em português do Brasil, curto e objetivo.`;
}

/** Forma solta do que o modelo devolve; a normalização abaixo aperta. */
const saidaSchema = z.object({
  resumo: z.string(),
  operacoes: z.array(z.record(z.string(), z.unknown())),
});

const nulo = (v: unknown) => (v === undefined || v === "" ? null : v);
const inteiro = (v: unknown) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));

/**
 * O modelo pode chutar id, mandar 95.7 de confiança ou esquecer um campo.
 * Aqui tudo vira uma `Operacao` válida ou é descartado — a tela nunca vê
 * dado fora do contrato.
 */
function normalizar(bruta: Record<string, unknown>, idsAnimais: Set<string>, idsGrupos: Set<string>): Operacao | null {
  const tipo = String(bruta.tipo);
  const animalId = typeof bruta.animalId === "string" && idsAnimais.has(bruta.animalId) ? bruta.animalId : null;
  const aceitaGrupo = (TIPOS_COM_GRUPO as readonly string[]).includes(tipo);
  const grupoId =
    aceitaGrupo && !animalId && typeof bruta.grupoId === "string" && idsGrupos.has(bruta.grupoId) ? bruta.grupoId : null;
  const confianca = Math.max(0, Math.min(100, Math.round(Number(bruta.confianca) || 0)));
  // Sem alvo do cadastro a operação não é aplicável — e o revisor tem que ver
  // isso, por mais certo que o modelo esteja do resto. Cadastro não tem alvo.
  const semAlvo = tipo !== "cadastrar_animal" && !animalId && !grupoId;
  const base = {
    titulo: String(bruta.titulo ?? ""),
    alvo: String(bruta.alvo ?? ""),
    animalId,
    grupoId,
    detalhe: String(bruta.detalhe ?? ""),
    confianca: semAlvo ? Math.min(confianca, 60) : confianca,
    trecho: String(bruta.trecho ?? ""),
  };

  let candidata: unknown;
  switch (tipo) {
    case "agendar_consulta":
      candidata = {
        ...base,
        tipo,
        data: nulo(bruta.data),
        hora: nulo(bruta.hora),
        tipoConsulta: bruta.tipoConsulta ?? "consulta",
        observacoes: nulo(bruta.observacoes),
      };
      break;
    case "registrar_anotacao":
      candidata = { ...base, tipo, texto: bruta.texto || base.detalhe };
      break;
    case "registrar_peso":
      candidata = { ...base, tipo, pesoKg: Number(bruta.pesoKg) };
      break;
    case "aplicar_vacina":
      candidata = { ...base, tipo, vacina: bruta.vacina, dose: nulo(bruta.dose), data: nulo(bruta.data), proximaData: nulo(bruta.proximaData) };
      break;
    case "registrar_remedio":
      candidata = { ...base, tipo, remedio: bruta.remedio, dose: nulo(bruta.dose), dias: inteiro(bruta.dias), carenciaDias: inteiro(bruta.carenciaDias) };
      break;
    case "registrar_parto":
      candidata = { ...base, tipo, data: nulo(bruta.data), crias: inteiro(bruta.crias), observacoes: nulo(bruta.observacoes) };
      break;
    case "cadastrar_animal":
      candidata = {
        ...base,
        tipo,
        animalId: null,
        grupoId: null,
        nome: bruta.nome || base.alvo,
        especie: (ESPECIES as readonly string[]).includes(String(bruta.especie)) ? bruta.especie : "outro",
        raca: nulo(bruta.raca),
        sexo: (SEXOS as readonly string[]).includes(String(bruta.sexo)) ? bruta.sexo : null,
        nascimento: nulo(bruta.nascimento),
      };
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
      max_tokens: 3000,
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
      max_tokens: 3000,
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
export async function analisar(
  transcricao: string,
  hoje: string,
  animais: AnimalParaIa[],
  grupos: GrupoParaIa[] = [],
): Promise<Analise> {
  const cfg = interpretacao();
  if (!cfg) throw new IaNaoConfigurada("A interpretação por IA (GROQ_API_KEY)");

  const sistema = instrucoes(hoje, animais, grupos);
  const bruto =
    cfg.tipo === "anthropic"
      ? await chamarAnthropic(cfg, sistema, transcricao)
      : await chamarOpenAi(cfg, sistema, transcricao);

  const saida = saidaSchema.safeParse(bruto);
  if (!saida.success) throw new Error("A IA respondeu fora do formato esperado.");

  const idsAnimais = new Set(animais.map((a) => a.id));
  const idsGrupos = new Set(grupos.map((g) => g.id));
  return {
    resumo: saida.data.resumo.trim(),
    operacoes: saida.data.operacoes
      .map((op) => normalizar(op, idsAnimais, idsGrupos))
      .filter((op): op is Operacao => op !== null),
  };
}
