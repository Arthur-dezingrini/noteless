import { z } from "zod";

/**
 * Papéis do Better Auth (organization plugin). `owner` é quem criou a
 * organização; `admin` gerencia usuários e dados; `member` só opera.
 */
export const PAPEIS = ["owner", "admin", "member"] as const;
export const papelSchema = z.enum(PAPEIS);
export type Papel = z.infer<typeof papelSchema>;

export const ROTULO_PAPEL: Record<Papel, string> = {
  owner: "Administrador",
  admin: "Administrador",
  member: "Membro",
};

/** Um usuário como membro de uma organização — o que a lista mostra. */
export const usuarioSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  name: z.string(),
  email: z.string(),
  cargo: z.string().nullish(),
  role: papelSchema,
  createdAt: z.coerce.date(),
});

export const usuarioListaSchema = z.array(usuarioSchema);
export type Usuario = z.infer<typeof usuarioSchema>;

export const criarUsuarioSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("E-mail inválido."),
  cargo: z.string().trim().max(60).optional(),
  role: z.enum(["admin", "member"]),
  // Senha temporária, definida pelo administrador e repassada à pessoa.
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});
export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;

export const atualizarUsuarioSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").optional(),
  cargo: z.string().trim().max(60).optional(),
  role: z.enum(["admin", "member"]).optional(),
});
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;
