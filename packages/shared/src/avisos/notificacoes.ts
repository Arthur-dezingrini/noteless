import { z } from "zod";

/** Aviso do sino. Cada um leva a algum lugar do sistema. */
export const notificacaoSchema = z.object({
  id: z.string(),
  texto: z.string(),
  detalhe: z.string().nullish(),
  link: z.string().nullish(),
  lida: z.boolean(),
  createdAt: z.coerce.date(),
});
export const notificacaoListaSchema = z.array(notificacaoSchema);
export type Notificacao = z.infer<typeof notificacaoSchema>;
