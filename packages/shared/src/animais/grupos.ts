import { z } from "zod";

/** Grupo de animais (lote, baia, ninhada). Alvo de vacina/remédio em massa. */
export const grupoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string().nullish(),
  /** Chave de espécie, ou "misturado". */
  especie: z.string().nullish(),
  local: z.string().nullish(),
  animalIds: z.array(z.string()),
  /** "Vacina de aftosa · 25/09" — próxima consulta do grupo, se houver. */
  proximo: z.string().nullish(),
  /** "Vacina de brucelose em 17 animais · 24/09" — último registro em massa. */
  ultimo: z.string().nullish(),
  createdAt: z.coerce.date(),
});
export const grupoListaSchema = z.array(grupoSchema);
export type Grupo = z.infer<typeof grupoSchema>;

export const criarGrupoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do grupo.").max(60, "No máximo 60 caracteres."),
  descricao: z.string().trim().max(200, "No máximo 200 caracteres.").nullish(),
  especie: z.string().trim().max(20).nullish(),
  local: z.string().trim().max(60, "No máximo 60 caracteres.").nullish(),
  animalIds: z.array(z.string()).max(5000),
});
export type CriarGrupoInput = z.infer<typeof criarGrupoSchema>;
