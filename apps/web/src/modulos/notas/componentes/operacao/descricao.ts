import { CAMPOS_CORRIGIVEIS, CAMPOS_APONTAMENTO, ESPECIES, ROTULO_CAMPO_APONTAMENTO, ROTULO_ESPECIE, ROTULO_SEXO, ROTULO_TIPO_CONSULTA, SEXOS, TIPOS_AVIARIO, TIPOS_CONSULTA, temAlvo, type CampoCorrigivel, type Especie, type Ocorrencia, type Operacao, type Sexo, type TipoConsulta } from "@vocare/shared";

import { formatar } from "@/lib/datas";

import { type Cadastro } from "../tipos";

/** Abaixo disto a tela pede para conferir o dado. */
export const LIMIAR_ATENCAO = 70;

/** "o retorno", "a vacinação"… — para montar a frase do rodapé. */
export const ARTIGO_CONSULTA: Record<TipoConsulta, string> = {
  consulta: "a consulta",
  vacinacao: "a vacinação",
  retorno: "o retorno",
  cirurgia: "a cirurgia",
  checkup: "o check-up",
  exame: "o exame",
  outro: "o atendimento",
};

export const ROTULO_CAMPO: Record<CampoCorrigivel, string> = {
  animalId: "Animal",
  grupoId: "Grupo",
  pesoKg: "Peso",
  texto: "Anotação",
  tipoConsulta: "Tipo",
  data: "Data",
  hora: "Hora",
  observacoes: "Observações",
  vacina: "Vacina",
  dose: "Dose",
  proximaData: "Próxima dose",
  remedio: "Remédio",
  dias: "Duração",
  carenciaDias: "Carência",
  crias: "Crias",
  nome: "Nome",
  especie: "Espécie",
  raca: "Raça",
  sexo: "Sexo",
  nascimento: "Nascimento",
  ...ROTULO_CAMPO_APONTAMENTO,
  instalacaoId: "Galpão",
  loteId: "Lote",
  pesoMedioG: "Peso médio (g)",
  uniformidadePct: "Uniformidade (%)",
  amostra: "Amostra",
  via: "Via",
};

export const CAMPOS_DATA: CampoCorrigivel[] = ["data", "proximaData", "nascimento"];
export const CAMPOS_INTEIROS: CampoCorrigivel[] = [
  "dias", "carenciaDias", "crias", "amostra",
  ...CAMPOS_APONTAMENTO.filter((c) => c !== "racaoKg" && c !== "aguaL"),
];
/** Decimais das operações do aviário (aceitam vírgula). */
export const CAMPOS_DECIMAIS: CampoCorrigivel[] = ["pesoMedioG", "uniformidadePct", "racaoKg", "aguaL"];
/** Podem ficar vazios (null). */
export const CAMPOS_OPCIONAIS: CampoCorrigivel[] = [
  "data", "hora", "observacoes", "dose", "proximaData", "dias", "carenciaDias", "crias", "raca", "sexo", "nascimento",
  "uniformidadePct", "amostra", "via", ...CAMPOS_APONTAMENTO,
];
export const CAMPOS_ESCOLHA: CampoCorrigivel[] = ["animalId", "grupoId", "instalacaoId", "loteId", "tipoConsulta", "especie", "sexo"];
/** O alvo aparece na linha "nº 07 Thor → …"; na tabela, só quando falta, foi corrigido ou é grupo. */
export const CAMPOS_ALVO: CampoCorrigivel[] = ["animalId", "grupoId", "instalacaoId", "loteId"];

/** Pode ficar vazio nesta operação? (`sexo` é obrigatório na pesagem do lote.) */
export function opcional(tipo: Operacao["tipo"], c: CampoCorrigivel) {
  if (c === "sexo" && tipo === "pesar_lote") return false;
  return CAMPOS_OPCIONAIS.includes(c);
}

export function ehAviario(op: Operacao) {
  return TIPOS_AVIARIO.includes(op.tipo);
}

export function diaMes(data: string | null) {
  return data ? formatar(data, { day: "2-digit", month: "2-digit" }) : "hoje";
}

export function naoEntendido(oc: Ocorrencia) {
  return oc.transcricao.trim() === "";
}

export function rotulo(a: { numero: string | null; nome: string }) {
  if (a.numero && a.nome) return `nº ${a.numero} ${a.nome}`;
  return a.numero ? `nº ${a.numero}` : a.nome;
}

/** Nome do alvo: animal do cadastro, grupo, animal novo, ou o que foi dito. */
export function nomeAlvo(op: Operacao, cad: Cadastro): string {
  if (op.tipo === "cadastrar_animal") return op.nome;
  if (op.tipo === "apontar_galpao") {
    return (op.instalacaoId && cad.galpoes.get(op.instalacaoId)?.nome) || `${op.alvo} (não encontrado)`;
  }
  if (op.tipo === "pesar_lote" || op.tipo === "vacinar_lote") {
    return (op.loteId && cad.lotes.get(op.loteId)?.codigo) || `${op.alvo} (não encontrado)`;
  }
  if (op.grupoId) {
    const g = cad.grupos.get(op.grupoId);
    return g ? `${g.nome} (${g.animais} ${g.animais === 1 ? "animal" : "animais"})` : op.alvo;
  }
  const a = op.animalId ? cad.animais.get(op.animalId) : undefined;
  if (a) return rotulo(a);
  return op.animalId ? "animal novo" : `${op.alvo} (não encontrado)`;
}

/** "da Mimosa", "do Thor", "de Rex" (sexo não cadastrado), "do Lote 4". */
export function deAlvo(op: Exclude<Operacao, { tipo: "apontar_galpao" | "pesar_lote" | "vacinar_lote" }>, cad: Cadastro) {
  if (op.grupoId) return `do ${cad.grupos.get(op.grupoId)?.nome ?? op.alvo}`;
  const a = op.animalId ? cad.animais.get(op.animalId) : undefined;
  const prep = a?.sexo === "femea" ? "da" : a?.sexo === "macho" ? "do" : "de";
  return `${prep} ${a?.nome || (a ? rotulo(a) : op.alvo)}`;
}

export function juntar(partes: string[]) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** O que cada operação vira, dentro da frase do rodapé. */
export function efeito(op: Operacao, cad: Cadastro): string {
  switch (op.tipo) {
    case "apontar_galpao":
      return `o apontamento do ${op.instalacaoId ? (cad.galpoes.get(op.instalacaoId)?.nome ?? op.alvo) : op.alvo} em ${diaMes(op.data)}`;
    case "pesar_lote":
      return `a pesagem ${op.sexo === "femea" ? "das fêmeas" : "dos machos"} do ${nomeAlvo(op, cad)}`;
    case "vacinar_lote":
      return `a vacina ${op.vacina} no ${nomeAlvo(op, cad)}`;
    default:
      break;
  }
  const de = deAlvo(op, cad);
  switch (op.tipo) {
    case "registrar_peso":
      return `o peso no histórico ${de}`;
    case "registrar_anotacao":
      return `a anotação no histórico ${de}`;
    case "agendar_consulta":
      return `${ARTIGO_CONSULTA[op.tipoConsulta]} ${de} na agenda`;
    case "aplicar_vacina":
      return `a vacina ${op.vacina} no histórico ${de}`;
    case "registrar_remedio":
      return `o tratamento com ${op.remedio} no histórico ${de}`;
    case "registrar_parto":
      return `o parto no histórico ${de}`;
    case "cadastrar_animal":
      return `${op.nome} no cadastro de animais`;
    default:
      return "";
  }
}

/** Valor de um campo como o revisor lê. */
export function formatarCampo(c: CampoCorrigivel, valor: unknown, cad: Cadastro, alvo: string): string {
  if (valor === null || valor === undefined || valor === "") {
    if (c === "animalId") return `“${alvo}” (não encontrado)`;
    if (c === "data") return "hoje";
    if (c === "hora") return "não dita";
    return "—";
  }
  switch (c) {
    case "animalId": {
      const a = cad.animais.get(String(valor));
      return a ? rotulo(a) : "animal novo";
    }
    case "grupoId":
      return cad.grupos.get(String(valor))?.nome ?? "Grupo removido";
    case "instalacaoId":
      return cad.galpoes.get(String(valor))?.nome ?? "Galpão removido";
    case "loteId":
      return cad.lotes.get(String(valor))?.codigo ?? "Lote removido";
    case "racaoKg":
    case "aguaL":
    case "pesoMedioG":
    case "uniformidadePct":
      return Number(valor).toLocaleString("pt-BR");
    case "pesoKg":
      return `${Number(valor).toLocaleString("pt-BR")} kg`;
    case "tipoConsulta":
      return ROTULO_TIPO_CONSULTA[valor as TipoConsulta] ?? String(valor);
    case "especie":
      return ROTULO_ESPECIE[valor as Especie] ?? String(valor);
    case "sexo":
      return ROTULO_SEXO[valor as Sexo] ?? String(valor);
    case "dias":
    case "carenciaDias":
      return `${valor} ${valor === 1 ? "dia" : "dias"}`;
    case "data":
    case "proximaData":
    case "nascimento":
      return formatar(String(valor), { day: "2-digit", month: "2-digit", year: "numeric" });
    default:
      return String(valor);
  }
}

export function opcoesDe(c: CampoCorrigivel, cad: Cadastro): { v: string; r: string }[] {
  switch (c) {
    case "animalId":
      return [...cad.animais.values()].map((a) => ({ v: a.id, r: rotulo(a) }));
    case "grupoId":
      return [...cad.grupos.values()].map((g) => ({ v: g.id, r: `${g.nome} (${g.animais})` }));
    case "instalacaoId":
      return [...cad.galpoes.values()].map((g) => ({ v: g.id, r: g.nome }));
    case "loteId":
      return [...cad.lotes.values()].filter((l) => l.ativo).map((l) => ({ v: l.id, r: l.codigo }));
    case "tipoConsulta":
      return TIPOS_CONSULTA.map((t) => ({ v: t, r: ROTULO_TIPO_CONSULTA[t] }));
    case "especie":
      return ESPECIES.map((e) => ({ v: e, r: ROTULO_ESPECIE[e] }));
    case "sexo":
      return SEXOS.map((x) => ({ v: x, r: ROTULO_SEXO[x] }));
    default:
      return [];
  }
}

/** Campos da tabela de detalhes, na ordem de leitura. */
export function camposDe(op: Operacao): CampoCorrigivel[] {
  const todos = CAMPOS_CORRIGIVEIS[op.tipo] as readonly CampoCorrigivel[];
  const corrigido = op.original ?? {};
  return [
    ...todos.filter((c) => !CAMPOS_ALVO.includes(c)),
    ...todos.filter((c) => {
      if (c === "instalacaoId" || c === "loteId") return !temAlvo(op) || c in corrigido;
      if (ehAviario(op)) return false;
      const m = op as { grupoId?: string | null };
      if (c === "grupoId") return !!m.grupoId;
      if (c === "animalId") return !m.grupoId && (!temAlvo(op) || "animalId" in corrigido);
      return false;
    }),
  ];
}
