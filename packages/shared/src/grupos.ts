import { z } from "zod";

/** Grupo de animais (lote, baia, ninhada). Alvo de vacina/remédio em massa. */
export const grupoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string().nullish(),
  animalIds: z.array(z.string()),
  createdAt: z.coerce.date(),
});
export const grupoListaSchema = z.array(grupoSchema);
export type Grupo = z.infer<typeof grupoSchema>;

export const criarGrupoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do grupo.").max(60, "No máximo 60 caracteres."),
  descricao: z.string().trim().max(200, "No máximo 200 caracteres.").nullish(),
  animalIds: z.array(z.string()).max(5000),
});
export type CriarGrupoInput = z.infer<typeof criarGrupoSchema>;
