import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("E-mail inválido."),
  password: z.string().min(1, "Informe sua senha."),
});


/**
 * Forma da sessão que o web consome de GET /api/auth/get-session.
 * Deliberadamente menor que o que o Better Auth devolve: o front declara só o
 * que usa, e o parse garante que o back continua honrando isso.
 */
/** Tipo da pessoa na plataforma. Super usuário vincula qualquer um a qualquer empresa. */
export const TIPOS_USUARIO = ["comum", "super"] as const;
export const tipoUsuarioSchema = z.enum(TIPOS_USUARIO);
export type TipoUsuario = z.infer<typeof tipoUsuarioSchema>;

export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable().optional(),
    cargo: z.string().nullish(),
    // Nulo (linha anterior à coluna) conta como comum.
    tipo: tipoUsuarioSchema.nullish().transform((t) => t ?? "comum"),
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
export const TIPOS_CONTA = ["Sítio", "Fazenda", "Casa", "Clínica", "Canil ou gatil", "Haras", "Outro"] as const;

export const organizationMetadataSchema = z.object({
  /** Sítio, Fazenda, Casa, Clínica… — o sistema serve para todos. */
  tipo: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  endereco: z.string().optional(),
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
