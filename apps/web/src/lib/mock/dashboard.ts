/**
 * DADOS DE EXEMPLO — reproduzem o protótipo do Figma enquanto o modelo de
 * domínio (fazendas, lotes, animais, manejos) não existe. Quando existir,
 * este arquivo some e o dashboard passa a ler da api.
 */
export type Stat = {
  label: string;
  value: string;
  hint: string;
  tone: "green" | "blue" | "purple" | "orange";
  icon: "calendar" | "heart" | "dollar" | "chart";
};

export const STATS: Stat[] = [
  { label: "Consultas hoje", value: "12", hint: "+2 desde ontem", tone: "green", icon: "calendar" },
  { label: "Animais cadastrados", value: "1.240", hint: "18 novos este mês", tone: "blue", icon: "heart" },
  { label: "Faturamento mensal", value: "R$ 28.450", hint: "+12% vs mês anterior", tone: "purple", icon: "dollar" },
  { label: "Taxa de retorno", value: "87%", hint: "Meta: 85%", tone: "orange", icon: "chart" },
];

export type Alert = { text: string; tone: "yellow" | "red" | "blue"; href?: string };

export const ALERTS: Alert[] = [
  { text: "3 animais com vacinas vencendo esta semana", tone: "yellow" },
  { text: "4 ocorrências de voz aguardando revisão", tone: "red", href: "/ocorrencias" },
  { text: "2 retornos não confirmados para amanhã", tone: "blue" },
];

export type Revenue = { label: string; value: string; pct: number };

export const REVENUE: Revenue[] = [
  { label: "Consultas", value: "R$ 4.200", pct: 70 },
  { label: "Cirurgias", value: "R$ 3.800", pct: 63 },
  { label: "Vacinas", value: "R$ 1.600", pct: 27 },
  { label: "Exames", value: "R$ 2.100", pct: 35 },
];
