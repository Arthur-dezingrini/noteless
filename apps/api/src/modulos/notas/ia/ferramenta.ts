import { CAMPOS_APONTAMENTO, ESPECIES, ROTULO_CAMPO_APONTAMENTO, SEXOS, TIPOS_CONSULTA } from "@vocare/shared";

export const TIPOS_OPERACAO = [
  "agendar_consulta",
  "registrar_anotacao",
  "registrar_peso",
  "aplicar_vacina",
  "registrar_remedio",
  "registrar_parto",
  "cadastrar_animal",
] as const;

/** Só entram na ferramenta e nas instruções quando a organização tem galpão com lote. */
export const TIPOS_AVIARIO_IA = ["apontar_galpao", "pesar_lote", "vacinar_lote"] as const;

// Todo campo que só vale para alguns tipos aceita null: o Groq confere a
// resposta contra o schema e recusa a chamada inteira (400) quando o modelo
// manda null num campo que pede texto ou número.
const textoOuNulo = (description: string) => ({ type: ["string", "null"], description });
const inteiroOuNulo = (description: string) => ({ type: ["integer", "null"], description });
const numeroOuNulo = (description: string) => ({ type: ["number", "null"], description });

/**
 * O modelo devolve a análise chamando esta "ferramenta" — é o jeito de
 * receber JSON com forma garantida em vez de texto para fazer parse. Os
 * campos específicos de cada tipo ficam todos no mesmo objeto; a
 * normalização (normalizar.ts) pega só os que o tipo usa.
 */
export type Ferramenta = { name: string; description: string; input_schema: unknown };

export function ferramenta(comAviario: boolean) {
  const base = FERRAMENTA_BASE;
  if (!comAviario) return base;
  const item = base.input_schema.properties.operacoes.items;
  const contagens = Object.fromEntries(
    CAMPOS_APONTAMENTO.map((c) => [
      c,
      c === "racaoKg" || c === "aguaL"
        ? numeroOuNulo(`apontar_galpao: ${ROTULO_CAMPO_APONTAMENTO[c]} no dia.`)
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
              pesoMedioG: numeroOuNulo("pesar_lote: peso médio das aves em gramas."),
              uniformidadePct: numeroOuNulo("pesar_lote: uniformidade em %, se dita."),
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
      // Antes do resumo: o modelo escreve na ordem do schema, e interpreta
      // melhor já tendo acertado as palavras.
      transcricaoCorrigida: textoOuNulo(
        "A transcrição com os erros de reconhecimento de voz corrigidos ('parca 7' → 'porca 7', 'deitões' → 'leitões', nome do cadastro escrito errado). Só isso: não resuma, não reescreva, não acrescente; números ficam como vieram. Null se não há o que corrigir.",
      ),
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
            detalhe: textoOuNulo("O que será registrado, em uma linha."),
            confianca: { type: "integer", minimum: 0, maximum: 100 },
            trecho: { type: "string", description: "Trecho literal da transcrição que justifica a operação." },
            data: textoOuNulo("AAAA-MM-DD: dia da consulta, da vacina ou do parto; null se não foi dito."),
            hora: textoOuNulo("agendar_consulta: HH:MM, ou null se não foi dito."),
            tipoConsulta: { type: ["string", "null"], enum: [...TIPOS_CONSULTA, null], description: "agendar_consulta." },
            observacoes: textoOuNulo("agendar_consulta/registrar_parto: observações."),
            texto: textoOuNulo("registrar_anotacao: a anotação clínica ou de manejo."),
            pesoKg: numeroOuNulo("registrar_peso: peso em kg."),
            vacina: textoOuNulo("aplicar_vacina: nome da vacina (ex.: 'aftosa', 'V10', 'antirrábica')."),
            dose: textoOuNulo("aplicar_vacina/registrar_remedio: dose ('2ª dose', '5 ml')."),
            proximaData: textoOuNulo("aplicar_vacina: AAAA-MM-DD da próxima dose/reforço, se foi dito."),
            remedio: textoOuNulo("registrar_remedio: nome do remédio."),
            dias: inteiroOuNulo("registrar_remedio: por quantos dias, a partir de hoje."),
            carenciaDias: inteiroOuNulo("registrar_remedio: carência em dias, se foi dita."),
            crias: inteiroOuNulo("registrar_parto: quantas crias nasceram vivas."),
            nomesCrias: textoOuNulo("registrar_parto: nomes ditos para as crias, separados por vírgula ('Faísca'); null se nenhum."),
            nome: textoOuNulo(
              "cadastrar_animal: o nome ou o número dito ('Mimosa', 'brinco 45'). Descrição não é nome ('porco novo', 'uma vaca', a raça): null.",
            ),
            especie: { type: ["string", "null"], enum: [...ESPECIES, null], description: "cadastrar_animal." },
            raca: textoOuNulo("cadastrar_animal: raça."),
            sexo: { type: ["string", "null"], enum: [...SEXOS, null], description: "cadastrar_animal." },
            nascimento: textoOuNulo("cadastrar_animal: AAAA-MM-DD de nascimento (hoje, se nasceu agora)."),
          },
          // Sem "detalhe": a tela não o usa, e o modelo o esquecia nas operações
          // do aviário — o Groq recusava a resposta inteira.
          required: ["tipo", "titulo", "alvo", "animalId", "confianca", "trecho"],
        },
      },
    },
    required: ["resumo", "operacoes"],
  },
} as const;
