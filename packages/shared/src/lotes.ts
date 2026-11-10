import { z } from "zod";
import { especieSchema, sexoSchema } from "./animais";
import type { IndicadoresDia, IndicadoresLote, SemanaLote } from "./indicadores-lote";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

/** Onde os animais ficam: galpão de aves, pasto, baia ou incubadora. */
export const TIPOS_INSTALACAO = ["galpao", "pasto", "baia", "incubadora"] as const;
export const tipoInstalacaoSchema = z.enum(TIPOS_INSTALACAO);
export type TipoInstalacao = z.infer<typeof tipoInstalacaoSchema>;
export const ROTULO_TIPO_INSTALACAO: Record<TipoInstalacao, string> = {
  galpao: "Galpão",
  pasto: "Pasto",
  baia: "Baia",
  incubadora: "Incubadora",
};

export const FASES_LOTE = ["recria", "producao"] as const;
export const faseLoteEnumSchema = z.enum(FASES_LOTE);
export type FaseLote = z.infer<typeof faseLoteEnumSchema>;
export const ROTULO_FASE_LOTE: Record<FaseLote, string> = {
  recria: "Recria",
  producao: "Produção",
};

export const SITUACOES_LOTE = ["ativo", "encerrado"] as const;
export type SituacaoLote = (typeof SITUACOES_LOTE)[number];

/** Campos do apontamento diário de um galpão. */
export const CAMPOS_APONTAMENTO = [
  "mortasFemeas",
  "mortasMachos",
  "eliminadasFemeas",
  "eliminadasMachos",
  "ovosTotal",
  "ovosIncubaveis",
  "ovosTrincados",
  "ovosSujos",
  "ovosDuasGemas",
  "ovosDescarte",
  "racaoKg",
  "aguaL",
] as const;
export type CampoApontamento = (typeof CAMPOS_APONTAMENTO)[number];

export const ROTULO_CAMPO_APONTAMENTO: Record<CampoApontamento, string> = {
  mortasFemeas: "Fêmeas mortas",
  mortasMachos: "Machos mortos",
  eliminadasFemeas: "Fêmeas eliminadas",
  eliminadasMachos: "Machos eliminados",
  ovosTotal: "Ovos (total)",
  ovosIncubaveis: "Ovos incubáveis",
  ovosTrincados: "Ovos trincados",
  ovosSujos: "Ovos sujos",
  ovosDuasGemas: "Ovos de duas gemas",
  ovosDescarte: "Ovos de descarte",
  racaoKg: "Ração (kg)",
  aguaL: "Água (L)",
};

/** Classes em que o total de ovos se divide. */
export const CLASSES_OVO = [
  "ovosIncubaveis",
  "ovosTrincados",
  "ovosSujos",
  "ovosDuasGemas",
  "ovosDescarte",
] as const;

/** Mortalidade diária acima disso (0,1% do plantel) vira alerta. */
export const LIMITE_MORTALIDADE_DIA = 0.001;

// Instalações

export const instalacaoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: tipoInstalacaoSchema,
  capacidade: z.number().nullable(),
  areaM2: z.number().nullable(),
  ativa: z.boolean(),
  loteAtual: z.object({ id: z.string(), codigo: z.string() }).nullable(),
});
export type Instalacao = z.infer<typeof instalacaoSchema>;

export const criarInstalacaoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(60, "No máximo 60 caracteres."),
  tipo: tipoInstalacaoSchema,
  capacidade: z.number().int("Use um número inteiro.").min(1, "Informe 1 ou mais.").nullish(),
  areaM2: z.number().positive("Informe um valor maior que zero.").nullish(),
});
export type CriarInstalacaoInput = z.infer<typeof criarInstalacaoSchema>;

export const editarInstalacaoSchema = criarInstalacaoSchema.partial().extend({
  ativa: z.boolean().optional(),
});
export type EditarInstalacaoInput = z.infer<typeof editarInstalacaoSchema>;

// Apontamento diário

const contagem = z.number().int("Use um número inteiro.").min(0, "Não pode ser negativo.").nullish();
const quantidade = z.number().min(0, "Não pode ser negativo.").nullish();

/** Os campos do apontamento, sem a regra da soma de ovos (para quem os reaproveita noutro schema). */
export const valoresApontamentoBase = z.object({
    mortasFemeas: contagem,
    mortasMachos: contagem,
    eliminadasFemeas: contagem,
    eliminadasMachos: contagem,
    ovosTotal: contagem,
    ovosIncubaveis: contagem,
    ovosTrincados: contagem,
    ovosSujos: contagem,
    ovosDuasGemas: contagem,
    ovosDescarte: contagem,
    racaoKg: quantidade,
    aguaL: quantidade,
    observacoes: z.string().trim().max(500, "No máximo 500 caracteres.").nullish(),
});

export const valoresApontamentoSchema = valoresApontamentoBase
  .superRefine((v, ctx) => {
    if (v.ovosTotal == null) return;
    const soma = CLASSES_OVO.reduce((s, k) => s + (v[k] ?? 0), 0);
    if (soma > v.ovosTotal) {
      ctx.addIssue({ code: "custom", message: "A soma das classes de ovo passa do total.", path: ["ovosTotal"] });
    }
  });
export type ValoresApontamento = z.infer<typeof valoresApontamentoSchema>;

// Lotes

export const criarLoteSchema = z.object({
  codigo: z.string().trim().min(1, "Informe o código do lote.").max(30, "No máximo 30 caracteres."),
  especie: especieSchema.default("ave"),
  linhagem: z.string().trim().max(60, "No máximo 60 caracteres.").nullish(),
  dataAlojamento: dataIso,
  idadeAlojamentoDias: z.number().int().min(0, "Não pode ser negativo.").default(0),
  fase: faseLoteEnumSchema.default("recria"),
  galpoes: z
    .array(
      z.object({
        instalacaoId: z.string().min(1),
        femeas: z.number().int().min(0, "Não pode ser negativo."),
        machos: z.number().int().min(0, "Não pode ser negativo."),
      }),
    )
    .min(1, "Informe ao menos um galpão."),
});
export type CriarLoteInput = z.input<typeof criarLoteSchema>;

export const transferirLoteSchema = z.object({
  data: dataIso,
  de: z.string().min(1),
  para: z.string().min(1),
  femeas: z.number().int().min(0, "Não pode ser negativo."),
  machos: z.number().int().min(0, "Não pode ser negativo."),
});
export type TransferirLoteInput = z.infer<typeof transferirLoteSchema>;

export const faseLoteSchema = z.object({ fase: faseLoteEnumSchema });
export const encerrarLoteSchema = z.object({ data: dataIso });

export const pesagemLoteInputSchema = z.object({
  data: dataIso,
  sexo: sexoSchema,
  pesoMedioG: z.number().positive("Informe um peso maior que zero.").max(10000, "Peso acima de 10.000 g."),
  uniformidadePct: z.number().min(0).max(100, "Use de 0 a 100.").nullish(),
  amostra: z.number().int().min(1, "Informe 1 ou mais.").nullish(),
  instalacaoId: z.string().nullish(),
});
export type PesagemLoteInput = z.infer<typeof pesagemLoteInputSchema>;

export const vacinacaoLoteInputSchema = z.object({
  data: dataIso,
  vacina: z.string().trim().min(1, "Informe a vacina.").max(80, "No máximo 80 caracteres."),
  via: z.string().trim().max(40, "No máximo 40 caracteres.").nullish(),
  proximaData: dataIso.nullish(),
});
export type VacinacaoLoteInput = z.infer<typeof vacinacaoLoteInputSchema>;

// Respostas de lote (espelham os tipos de ./indicadores-lote)

const pctOuNulo = z.number().nullable();

export const indicadoresDiaSchema = z.object({
  posturaPct: pctOuNulo,
  incubaveisPct: pctOuNulo,
  racaoGAveDia: pctOuNulo,
  aguaRacao: pctOuNulo,
  mortalidadeDiaPct: pctOuNulo,
}) satisfies z.ZodType<IndicadoresDia>;

const plantelSchema = z.object({ femeas: z.number(), machos: z.number() });

export const indicadoresLoteSchema = z.object({
  vivas: plantelSchema,
  mortalidadeAcumuladaPct: pctOuNulo,
  posturaSemanaPct: pctOuNulo,
  incubaveisPorFemea: pctOuNulo,
  racaoGAveDiaSemana: pctOuNulo,
}) satisfies z.ZodType<IndicadoresLote>;

export const semanaLoteSchema = z.object({
  semana: z.number(),
  inicio: dataIso,
  fim: dataIso,
  mortas: z.number(),
  eliminadas: z.number(),
  mortalidadePct: pctOuNulo,
  posturaPct: pctOuNulo,
  incubaveisPct: pctOuNulo,
  racaoGAveDia: pctOuNulo,
  pesoFemeaG: pctOuNulo,
  pesoMachoG: pctOuNulo,
  uniformidadeFemeaPct: pctOuNulo,
  uniformidadeMachoPct: pctOuNulo,
}) satisfies z.ZodType<SemanaLote>;

export const diaGalpaoSchema = z.object({
  data: dataIso,
  instalacaoId: z.string(),
  instalacaoNome: z.string(),
  ocorrenciaId: z.string().nullable(),
  valores: valoresApontamentoSchema,
  indicadores: indicadoresDiaSchema,
});
export type DiaGalpao = z.infer<typeof diaGalpaoSchema>;

export const loteResumoSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  linhagem: z.string().nullable(),
  fase: faseLoteEnumSchema,
  situacao: z.enum(SITUACOES_LOTE),
  dataAlojamento: dataIso,
  semana: z.number(),
  galpoes: z.array(z.object({ id: z.string(), nome: z.string() })),
  vivas: plantelSchema,
  posturaOntemPct: z.number().nullable(),
  mortalidadeSemanaPct: z.number().nullable(),
  semApontamentoHoje: z.boolean(),
  mortalidadeAltaHoje: z.boolean(),
});
export type LoteResumo = z.infer<typeof loteResumoSchema>;

export const fichaLoteSchema = z.object({
  lote: loteResumoSchema.extend({
    idadeAlojamentoDias: z.number(),
    femeasIniciais: z.number(),
    machosIniciais: z.number(),
    dataEncerramento: dataIso.nullable(),
  }),
  alojamentos: z.array(
    z.object({
      id: z.string(),
      instalacaoId: z.string(),
      instalacaoNome: z.string(),
      inicio: dataIso,
      fim: dataIso.nullable(),
      femeas: z.number(),
      machos: z.number(),
    }),
  ),
  indicadores: indicadoresLoteSchema,
  diario: z.array(diaGalpaoSchema),
  semanal: z.array(semanaLoteSchema),
  pesagens: z.array(
    z.object({
      id: z.string(),
      data: dataIso,
      sexo: sexoSchema,
      pesoMedioG: z.number(),
      uniformidadePct: z.number().nullable(),
      amostra: z.number().nullable(),
      ocorrenciaId: z.string().nullable(),
    }),
  ),
  vacinacoes: z.array(
    z.object({
      id: z.string(),
      data: dataIso,
      vacina: z.string(),
      via: z.string().nullable(),
      proximaData: dataIso.nullable(),
      ocorrenciaId: z.string().nullable(),
    }),
  ),
});
export type FichaLote = z.infer<typeof fichaLoteSchema>;

export const galpaoHojeSchema = z.object({
  instalacaoId: z.string(),
  nome: z.string(),
  loteId: z.string(),
  loteCodigo: z.string(),
  apontado: z.boolean(),
});
export type GalpaoHoje = z.infer<typeof galpaoHojeSchema>;
