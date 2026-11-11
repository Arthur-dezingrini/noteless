import { z } from "zod";

import { tipoUsuarioSchema } from "./auth";
import { papelSchema } from "./usuarios";

/** Contratos de /api/admin: o super usuário monta os acessos da plataforma inteira. */

export const vinculoSchema = z.object({
  memberId: z.string(),
  organizationId: z.string(),
  empresa: z.string(),
  papel: papelSchema,
});
export type Vinculo = z.infer<typeof vinculoSchema>;

export const usuarioAdminSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  cargo: z.string().nullable(),
  tipo: tipoUsuarioSchema,
  vinculos: z.array(vinculoSchema),
});
export const usuarioAdminListaSchema = z.array(usuarioAdminSchema);
export type UsuarioAdmin = z.infer<typeof usuarioAdminSchema>;

export const empresaSchema = z.object({ id: z.string(), nome: z.string() });
export const empresaListaSchema = z.array(empresaSchema);
export type Empresa = z.infer<typeof empresaSchema>;

export const criarVinculoSchema = z.object({
  userId: z.string().min(1, "Escolha a pessoa."),
  organizationId: z.string().min(1, "Escolha a empresa."),
  papel: papelSchema,
});
export type CriarVinculoInput = z.infer<typeof criarVinculoSchema>;

export const mudarPapelSchema = z.object({ papel: papelSchema });
export const mudarTipoSchema = z.object({ tipo: tipoUsuarioSchema });
