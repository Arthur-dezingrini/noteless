import "server-only";

import {
  usuarioListaSchema,
  type Usuario,
  empresaListaSchema,
  usuarioAdminListaSchema,
  type Empresa,
  type UsuarioAdmin,
  gravadorListaSchema,
  type Gravador,
} from "@vocare/shared";
import { cache } from "react";

import { apiFetch } from "@/lib/api";
import { corpoJson } from "@/lib/json";

/** Buscas do módulo conta na api, para páginas e layouts (server-only). */

/** Membros da organização com nome, e-mail, cargo e papel. */
export const getUsuarios = cache(
  async (organizationId: string): Promise<Usuario[]> => {
    const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/usuarios`);
    if (!res.ok) return [];

    const parsed = usuarioListaSchema.safeParse(await corpoJson(res));
    return parsed.success ? parsed.data : [];
  },
);

/** Todos os usuários da plataforma com os vínculos (só super usuário; senão, lista vazia). */
export const getUsuariosAdmin = cache(async (busca?: string): Promise<UsuarioAdmin[]> => {
  const q = busca?.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : "";
  const res = await apiFetch(`/api/admin/usuarios${q}`);
  if (!res.ok) return [];
  const parsed = usuarioAdminListaSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : [];
});

/** Todas as empresas da plataforma (só super usuário; senão, lista vazia). */
export const getEmpresas = cache(async (): Promise<Empresa[]> => {
  const res = await apiFetch("/api/admin/empresas");
  if (!res.ok) return [];
  const parsed = empresaListaSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : [];
});

/** Gravadores que mandam notas para a empresa (administrador; senão, lista vazia). */
export const getGravadores = cache(async (organizationId: string): Promise<Gravador[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/gravadores`);
  if (!res.ok) return [];
  const parsed = gravadorListaSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : [];
});

/** Todos os gravadores da plataforma (só super usuário; senão, lista vazia). */
export const getGravadoresAdmin = cache(async (): Promise<Gravador[]> => {
  const res = await apiFetch("/api/admin/gravadores");
  if (!res.ok) return [];
  const parsed = gravadorListaSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : [];
});
