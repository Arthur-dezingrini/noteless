/**
 * Identidade e conteúdo do painel de apresentação do login.
 * O protótipo do Figma usa "VetCare Pro"; o repositório é VOCare. Troque aqui
 * quando o nome final estiver decidido — é o único lugar onde ele aparece.
 */
export const BRAND_NAME = "VOCare";

export type ShowcaseSlide = {
  quote: string;
  stats: { value: string; label: string }[];
};

export const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    quote: "Cuidar de animais é uma vocação. Gerenciá-los não precisa ser difícil.",
    stats: [
      { value: "1.240", label: "Animais cadastrados" },
      { value: "98", label: "Consultas este mês" },
      { value: "4.8★", label: "Avaliação média" },
    ],
  },
  {
    quote: "Fale o manejo. O sistema escreve por você.",
    stats: [
      { value: "6s", label: "Por registro de voz" },
      { value: "0", label: "Formulários no curral" },
      { value: "100%", label: "Com trilha de auditoria" },
    ],
  },
  {
    quote: "Sem sinal no pasto? O registro espera e sobe sozinho.",
    stats: [
      { value: "24h", label: "De captura offline" },
      { value: "1", label: "Clique para aprovar" },
      { value: "3", label: "Fazendas por veterinário" },
    ],
  },
];
