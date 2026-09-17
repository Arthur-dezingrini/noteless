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
  password: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .max(128, "A senha precisa ter no máximo 128 caracteres."),
  confirmPassword: z.string().min(1, "Confirme a senha."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas devem ser iguais.",
  path: ["confirmPassword"],
});
export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;

export const atualizarUsuarioSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").optional(),
  email: z.string().trim().email("E-mail inválido.").optional(),
  cargo: z.string().trim().max(60).optional(),
  role: z.enum(["admin", "member"]).optional(),
  password: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .max(128, "A senha precisa ter no máximo 128 caracteres.")
    .optional(),
  confirmPassword: z.string().optional(),
}).superRefine((data, context) => {
  if (data.password && data.password !== data.confirmPassword) {
    context.addIssue({
      code: "custom",
      message: "As senhas devem ser iguais.",
      path: ["confirmPassword"],
    });
  }
  if (!data.password && data.confirmPassword) {
    context.addIssue({
      code: "custom",
      message: "Informe uma nova senha.",
      path: ["password"],
    });
  }
});
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

/** Vincular à organização alguém que JÁ tem conta (criada por outra organização). */
export const vincularUsuarioSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
  role: z.enum(["admin", "member"]),
});
export type VincularUsuarioInput = z.infer<typeof vincularUsuarioSchema>;
