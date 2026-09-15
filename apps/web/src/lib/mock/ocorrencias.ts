/**
 * DADOS DE EXEMPLO — o pipeline de áudio (WhatsApp → transcrição → IA →
 * sugestão) ainda não está ligado. A forma daqui antecipa o que a api vai
 * devolver: uma captura de voz, sua transcrição e as operações propostas,
 * cada uma com confiança e o trecho que a justifica.
 */
export type TipoOperacao = "vacinacao" | "observacao" | "peso" | "lote";

export type Operacao = {
  tipo: TipoOperacao;
  titulo: string;
  alvo: string;
  detalhe: string;
  /** 0–100. Abaixo de 70 a interface pede atenção. */
  confianca: number;
  trecho: string;
};

export type StatusOcorrencia = "pendente" | "aprovada" | "rejeitada";

export type Ocorrencia = {
  id: string;
  operador: string;
  canal: "WhatsApp" | "App";
  recebidoHa: string;
  duracao: string;
  transcricao: string;
  status: StatusOcorrencia;
  operacoes: Operacao[];
};

export const OCORRENCIAS: Ocorrencia[] = [
  {
    id: "oc-1042",
    operador: "João Batista",
    canal: "WhatsApp",
    recebidoHa: "há 12 min",
    duracao: "0:14",
    transcricao:
      "Apliquei a vacina dois no boi três, e o boi sete tá mancando da pata de trás.",
    status: "pendente",
    operacoes: [
      {
        tipo: "vacinacao",
        titulo: "Registrar vacinação",
        alvo: "Brinco 3",
        detalhe: "Vacina 2 do protocolo (aftosa) · hoje",
        confianca: 94,
        trecho: "apliquei a vacina dois no boi três",
      },
      {
        tipo: "observacao",
        titulo: "Registrar observação clínica",
        alvo: "Brinco 7",
        detalhe: "Claudicação em membro posterior",
        confianca: 88,
        trecho: "o boi sete tá mancando da pata de trás",
      },
    ],
  },
  {
    id: "oc-1041",
    operador: "Maria Aparecida",
    canal: "WhatsApp",
    recebidoHa: "há 40 min",
    duracao: "0:09",
    transcricao: "Pesei o quatro cinco dois um, deu quatrocentos e doze quilos.",
    status: "pendente",
    operacoes: [
      {
        tipo: "peso",
        titulo: "Registrar pesagem",
        alvo: "Brinco 4521",
        detalhe: "412 kg",
        confianca: 97,
        trecho: "pesei o quatro cinco dois um, deu quatrocentos e doze quilos",
      },
    ],
  },
  {
    id: "oc-1039",
    operador: "João Batista",
    canal: "WhatsApp",
    recebidoHa: "há 2 h",
    duracao: "0:07",
    transcricao: "Passei o lote do três pro pasto novo.",
    status: "pendente",
    operacoes: [
      {
        tipo: "lote",
        titulo: "Mudar animal de lote",
        alvo: "Brinco 3 — ou Lote 3?",
        detalhe: "Destino: Pasto Novo · ambíguo: 'lote do três' pode ser um animal ou o lote inteiro",
        confianca: 52,
        trecho: "passei o lote do três pro pasto novo",
      },
    ],
  },
  {
    id: "oc-1035",
    operador: "Maria Aparecida",
    canal: "App",
    recebidoHa: "ontem",
    duracao: "0:11",
    transcricao: "Vermifuguei o lote dois inteiro, ivermectina.",
    status: "aprovada",
    operacoes: [
      {
        tipo: "vacinacao",
        titulo: "Registrar tratamento em lote",
        alvo: "Lote 2 (38 animais)",
        detalhe: "Ivermectina · carência de 28 dias aplicada",
        confianca: 91,
        trecho: "vermifuguei o lote dois inteiro, ivermectina",
      },
    ],
  },
];
