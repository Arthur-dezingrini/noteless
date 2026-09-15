import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Forma da sessão que o web consome de GET /api/auth/get-session.
 * Deliberadamente menor que o que o Better Auth devolve: o front declara só o
 * que usa, e o parse garante que o back continua honrando isso.
 */
export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  session: z.object({
    id: z.string(),
    expiresAt: z.coerce.date(),
    activeOrganizationId: z.string().nullish(),
  }),
});

export type Session = z.infer<typeof sessionSchema>;

/** Forma mínima de uma organização como o web a consome de /organization/list. */
export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const organizationListSchema = z.array(organizationSchema);

export type Organization = z.infer<typeof organizationSchema>;
