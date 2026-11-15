import { CAMPOS_APONTAMENTO, ESPECIES, SEXOS, TIPOS_COM_GRUPO, operacaoSchema, type Operacao } from "@vocare/shared";

import type { GalpaoParaIa } from "../../aviario";
import { TIPOS_AVIARIO_IA } from "./ferramenta";

const nulo = (v: unknown) => (v === undefined || v === "" ? null : v);
const inteiro = (v: unknown) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));
const numeroOuNulo = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Palavras que descrevem o animal sem identificá-lo: "um porco novo", "a
// vaca", "filhote macho". Nome feito só delas (e da raça) não é nome.
const DESCRICAO = new Set(
  (
    "um uma o a os as de do da novo nova novinho novinha filhote cria recem nascido nascida animal bicho macho femea " +
    "porco porca leitao leitoa suino vaca boi touro bezerro bezerra novilha garrote cavalo egua potro potra " +
    "cabra bode cabrito ovelha carneiro cordeiro cachorro cao cadela gato gata galinha galo frango pintinho coelho"
  ).split(" "),
);

/**
 * O nome do animal a cadastrar, só se foi dito um: "porco novo" ou a raça
 * ("um landrace") vira "" e quem confere escreve. "Porca 3" fica — o número
 * identifica.
 */
export function nomeDito(valor: unknown, raca: unknown): string {
  const nome = typeof valor === "string" ? valor.trim() : "";
  const daRaca = new Set(typeof raca === "string" ? semAcento(raca).split(/\s+/) : []);
  const resto = semAcento(nome)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p && !DESCRICAO.has(p) && !daRaca.has(p));
  return resto.length ? nome : "";
}

/** Nomes das crias, só os que são nome: "Faísca, um macho" → "Faísca". */
export function nomesDitos(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const nomes = valor.split(",").map((n) => nomeDito(n, null)).filter(Boolean);
  return nomes.length ? nomes.join(", ") : null;
}

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
      candidata = {
        ...base,
        tipo,
        data: nulo(bruta.data),
        crias: inteiro(bruta.crias),
        observacoes: nulo(bruta.observacoes),
        cadastrarCrias: true,
        nomesCrias: nomesDitos(bruta.nomesCrias),
      };
      break;
    case "cadastrar_animal": {
      const raca = nulo(bruta.raca);
      const nome = nomeDito(bruta.nome, raca);
      candidata = {
        ...base,
        tipo,
        animalId: null,
        grupoId: null,
        // Sem nome não salva: quem confere escreve, e a confiança diz isso.
        confianca: nome ? base.confianca : Math.min(base.confianca, 60),
        nome,
        especie: (ESPECIES as readonly string[]).includes(String(bruta.especie)) ? bruta.especie : "outro",
        raca,
        sexo: (SEXOS as readonly string[]).includes(String(bruta.sexo)) ? bruta.sexo : null,
        nascimento: nulo(bruta.nascimento),
      };
      break;
    }
    default:
      return null;
  }

  const parsed = operacaoSchema.safeParse(candidata);
  return parsed.success ? parsed.data : null;
}

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
