import { z } from "zod";

export const TIPOS_RELATORIO = ["vacinas", "vencer", "peso", "tratamento", "ocorrencias"] as const;
export const tipoRelatorioSchema = z.enum(TIPOS_RELATORIO);
export type TipoRelatorio = z.infer<typeof tipoRelatorioSchema>;

export const ROTULO_RELATORIO: Record<TipoRelatorio, string> = {
  vacinas: "Vacinas aplicadas",
  vencer: "Vacinas a vencer",
  peso: "Peso",
  tratamento: "Em tratamento",
  ocorrencias: "Ocorrências",
};

/** Relatórios que dependem do período escolhido. */
export const RELATORIO_COM_PERIODO: readonly TipoRelatorio[] = ["vacinas", "ocorrencias"];

export const PERIODOS = ["mes", "mes-passado", "3-meses", "ano"] as const;
export type Periodo = (typeof PERIODOS)[number];
export const ROTULO_PERIODO: Record<Periodo, string> = {
  mes: "Este mês",
  "mes-passado": "Mês passado",
  "3-meses": "Últimos 3 meses",
  ano: "Este ano",
};

const linhaVacina = z.object({
  data: z.string(),
  alvo: z.string(),
  animalId: z.string().nullish(),
  vacina: z.string(),
  por: z.string().nullish(),
  porAudio: z.boolean(),
  doses: z.number().int(),
});
const linhaVencer = z.object({
  animalId: z.string(),
  alvo: z.string(),
  vacina: z.string(),
  vence: z.string(),
  /** Dias até vencer; negativo = atrasada. */
  dias: z.number().int(),
});
const linhaPeso = z.object({ mes: z.string(), rotulo: z.string(), pesoKg: z.number() });
const linhaTratamento = z.object({
  animalId: z.string(),
  alvo: z.string(),
  desde: z.string(),
  remedio: z.string(),
  ate: z.string().nullish(),
  proximo: z.string().nullish(),
});
const linhaOcorrencias = z.object({ nome: z.string(), gravadas: z.number(), salvas: z.number(), descartadas: z.number() });

export const relatorioSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("vacinas"), resumo: z.string(), linhas: z.array(linhaVacina) }),
  z.object({ tipo: z.literal("vencer"), resumo: z.string(), linhas: z.array(linhaVencer) }),
  z.object({
    tipo: z.literal("peso"),
    resumo: z.string(),
    animalId: z.string().nullish(),
    animais: z.array(z.object({ id: z.string(), rotulo: z.string() })),
    linhas: z.array(linhaPeso),
  }),
  z.object({ tipo: z.literal("tratamento"), resumo: z.string(), linhas: z.array(linhaTratamento) }),
  z.object({ tipo: z.literal("ocorrencias"), resumo: z.string(), linhas: z.array(linhaOcorrencias) }),
]);
export type Relatorio = z.infer<typeof relatorioSchema>;
