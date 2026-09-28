import { z } from "zod";

/** Um aviso do "Fique de olho" do Início. */
export const avisoSchema = z.object({
  id: z.string(),
  texto: z.string(),
  /** danger = já passou do prazo; warn = pede atenção. */
  tom: z.enum(["danger", "warn"]),
  link: z.string(),
});
export const avisoListaSchema = z.array(avisoSchema);
export type Aviso = z.infer<typeof avisoSchema>;
