import {
  CAMPOS_APONTAMENTO,
  ESPECIES,
  ROTULO_CAMPO_APONTAMENTO,
  ROTULO_ESPECIE,
  ROTULO_TIPO_CONSULTA,
  SEXOS,
  TIPOS_COM_GRUPO,
  TIPOS_CONSULTA,
  operacaoSchema,
  type Operacao,
} from "@vocare/shared";
import { z } from "zod";

import type { GalpaoParaIa } from "../modulos/aviario";
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

/** Só entram na ferramenta e nas instruções quando a organização tem galpão com lote. */
const TIPOS_AVIARIO_IA = ["apontar_galpao", "pesar_lote", "vacinar_lote"] as const;

const textoOuNulo = (description: string) => ({ type: ["string", "null"], description });
const inteiroOuNulo = (description: string) => ({ type: ["integer", "null"], description });

/**
 * O modelo devolve a análise chamando esta "ferramenta" — é o jeito de
 * receber JSON com forma garantida em vez de texto para fazer parse. Os
 * campos específicos de cada tipo ficam todos no mesmo objeto; a
 * normalização abaixo pega só os que o tipo usa.
 */
type Ferramenta = { name: string; description: string; input_schema: unknown };

export function ferramenta(comAviario: boolean) {
  const base = FERRAMENTA_BASE;
  if (!comAviario) return base;
  const item = base.input_schema.properties.operacoes.items;
  const contagens = Object.fromEntries(
    CAMPOS_APONTAMENTO.map((c) => [
      c,
      c === "racaoKg" || c === "aguaL"
        ? { type: ["number", "null"], description: `apontar_galpao: ${ROTULO_CAMPO_APONTAMENTO[c]} no dia.` }
        : inteiroOuNulo(`apontar_galpao: ${ROTULO_CAMPO_APONTAMENTO[c]} no dia.`),
    ]),
  );
  return {
    ...base,
    input_schema: {
      ...base.input_schema,
      properties: {
        ...base.input_schema.properties,
        operacoes: {
          ...base.input_schema.properties.operacoes,
          items: {
            ...item,
            properties: {
              ...item.properties,
              tipo: { type: "string", enum: [...TIPOS_OPERACAO, ...TIPOS_AVIARIO_IA] },
              instalacaoId: textoOuNulo("apontar_galpao: id do galpão da lista; null se nenhum bate."),
              loteId: textoOuNulo("pesar_lote/vacinar_lote: id do lote da lista; null se nenhum bate."),
              ...contagens,
              pesoMedioG: { type: "number", description: "pesar_lote: peso médio das aves em gramas." },
              uniformidadePct: { type: ["number", "null"], description: "pesar_lote: uniformidade em %, se dita." },
              amostra: inteiroOuNulo("pesar_lote: quantas aves foram pesadas, se dito."),
              via: textoOuNulo("vacinar_lote: via de aplicação (ocular, spray, água, injetável), se dita."),
            },
          },
        },
      },
    },
  };
}

const FERRAMENTA_BASE = {
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

export function instrucoes(hoje: string, animais: AnimalParaIa[], grupos: GrupoParaIa[], galpoes: GalpaoParaIa[] = []) {
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

  const num = (n: number) => n.toLocaleString("pt-BR");
  const blocoAviario = galpoes.length
    ? `

Galpões com lote alojado hoje (aviário de matrizes):
${galpoes
  .map((g) => `- ${g.nome} (id ${g.instalacaoId}): lote ${g.loteCodigo} (lote id ${g.loteId}), semana ${g.semana}, ${num(g.femeas)} fêmeas e ${num(g.machos)} machos`)
  .join("\n")}

Operações do aviário (animalId = null e grupoId = null sempre):
- apontar_galpao: números do dia de um galpão (mortas, eliminadas, ovos por classe, ração em kg, água em L). instalacaoId = id do galpão da lista; data = null se for hoje. Só preencha o que foi dito. Se o áudio citar mais de um galpão, gere UM apontar_galpao por galpão citado.
- pesar_lote: pesagem de aves do lote (loteId, sexo, pesoMedioG em gramas, uniformidadePct e amostra se ditos).
- vacinar_lote: vacina aplicada no lote inteiro (loteId, vacina, via, data, proximaData). Use esta, e não aplicar_vacina, quando o alvo é um lote de aves.`
    : "";

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
- registrar_anotacao: qualquer outra observação clínica ou de manejo sobre um animal.${blocoAviario}

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
export function normalizar(
  bruta: Record<string, unknown>,
  idsAnimais: Set<string>,
  idsGrupos: Set<string>,
  galpoes: GalpaoParaIa[] = [],
): Operacao | null {
  const tipo = String(bruta.tipo);
  if ((TIPOS_AVIARIO_IA as readonly string[]).includes(tipo)) return normalizarAviario(tipo, bruta, galpoes);
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

const numeroOuNulo = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** Operações do aviário miram galpão ou lote da lista, nunca animal; id fora da lista = sem alvo. */
function normalizarAviario(tipo: string, bruta: Record<string, unknown>, galpoes: GalpaoParaIa[]): Operacao | null {
  if (galpoes.length === 0) return null;
  const instalacaoId =
    typeof bruta.instalacaoId === "string" && galpoes.some((g) => g.instalacaoId === bruta.instalacaoId) ? bruta.instalacaoId : null;
  // O modelo às vezes devolve o código ("L-07") em vez do id: aceita os dois.
  const loteId =
    typeof bruta.loteId === "string"
      ? (galpoes.find((g) => g.loteId === bruta.loteId) ?? galpoes.find((g) => g.loteCodigo === bruta.loteId))?.loteId ?? null
      : null;
  const peso = numeroOuNulo(bruta.pesoMedioG);
  const pesoMedioG = peso !== null && Number.isFinite(peso) && peso > 0 && peso <= 10000 ? peso : null;
  const vacina = String(bruta.vacina ?? "").trim();
  // Sem alvo, sem o peso ou sem o nome da vacina a operação fica para o revisor completar.
  const semAlvo =
    tipo === "apontar_galpao" ? !instalacaoId : tipo === "pesar_lote" ? !loteId || pesoMedioG === null : !loteId || !vacina;
  const confianca = Math.max(0, Math.min(100, Math.round(Number(bruta.confianca) || 0)));
  const base = {
    titulo: String(bruta.titulo ?? ""),
    alvo: String(bruta.alvo ?? ""),
    animalId: null,
    grupoId: null,
    detalhe: String(bruta.detalhe ?? ""),
    confianca: semAlvo ? Math.min(confianca, 60) : confianca,
    trecho: String(bruta.trecho ?? ""),
  };

  let candidata: unknown;
  switch (tipo) {
    case "apontar_galpao":
      candidata = {
        ...base,
        tipo,
        instalacaoId,
        data: nulo(bruta.data),
        ...Object.fromEntries(
          CAMPOS_APONTAMENTO.map((c) => [c, c === "racaoKg" || c === "aguaL" ? numeroOuNulo(bruta[c]) : inteiro(bruta[c])]),
        ),
        observacoes: nulo(bruta.observacoes),
      };
      break;
    case "pesar_lote":
      candidata = {
        ...base,
        tipo,
        loteId,
        data: nulo(bruta.data),
        sexo: bruta.sexo,
        pesoMedioG,
        uniformidadePct: numeroOuNulo(bruta.uniformidadePct),
        amostra: inteiro(bruta.amostra),
      };
      break;
    default:
      candidata = {
        ...base,
        tipo,
        loteId,
        vacina,
        via: nulo(bruta.via),
        data: nulo(bruta.data),
        proximaData: nulo(bruta.proximaData),
      };
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
): Promise<Analise> {
  const cfg = interpretacao();
  if (!cfg) throw new IaNaoConfigurada("A interpretação por IA (GROQ_API_KEY)");

  const sistema = instrucoes(hoje, animais, grupos, galpoes);
  const ferr = ferramenta(galpoes.length > 0);
  const bruto =
    cfg.tipo === "anthropic"
      ? await chamarAnthropic(cfg, sistema, transcricao, ferr)
      : await chamarOpenAi(cfg, sistema, transcricao, ferr);

  const saida = saidaSchema.safeParse(bruto);
  if (!saida.success) throw new Error("A IA respondeu fora do formato esperado.");

  const idsAnimais = new Set(animais.map((a) => a.id));
  const idsGrupos = new Set(grupos.map((g) => g.id));
  return {
    resumo: saida.data.resumo.trim(),
    operacoes: saida.data.operacoes
      .map((op) => normalizar(op, idsAnimais, idsGrupos, galpoes))
      .filter((op): op is Operacao => op !== null),
  };
}
