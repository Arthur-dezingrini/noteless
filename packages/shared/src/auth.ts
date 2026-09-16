import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Informe seu nome completo.")
      .max(100, "Nome muito longo."),
    email: z
      .string()
      .trim()
      .min(1, "Informe seu e-mail.")
      .email("E-mail inválido."),
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .max(128, "A senha deve ter no máximo 128 caracteres."),
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas devem ser iguais.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

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

/**
 * Dados da clínica/fazenda que não têm coluna própria: vivem no `metadata`
 * (JSON livre) da organização do Better Auth. O web escreve e lê por aqui,
 * então este schema é o contrato do formato.
 */
export const organizationMetadataSchema = z.object({
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  endereco: z.string().optional(),
  horarioAbertura: z.string().optional(),
  horarioFechamento: z.string().optional(),
  preferencias: z
    .object({
      confirmacaoAutomatica: z.boolean().optional(),
      alertasEstoque: z.boolean().optional(),
    })
    .optional(),
});

export type OrganizationMetadata = z.infer<typeof organizationMetadataSchema>;

/** Forma mínima de uma organização como o web a consome de /organization/list. */
export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  // O Better Auth ora devolve o JSON já parseado, ora a string crua.
  metadata: z.preprocess(
    (v) => (typeof v === "string" ? JSON.parse(v) : v),
    organizationMetadataSchema.nullish(),
  ),
});

export const organizationListSchema = z.array(organizationSchema);

export type Organization = z.infer<typeof organizationSchema>;

/** Papel do usuário atual numa organização, de /organization/get-active-member-role. */
export const memberRoleSchema = z.object({ role: z.string() });

export type MemberRole = z.infer<typeof memberRoleSchema>;
