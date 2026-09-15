import {
  memberRoleSchema,
  organizationListSchema,
  sessionSchema,
  usuarioListaSchema,
  type MemberRole,
  type Organization,
  type Session,
  type Usuario,
} from "@vocare/shared";
import { redirect } from "next/navigation";
import { cache } from "react";

import { apiFetch } from "@/lib/api";

/**
 * Data Access Layer da sessão.
 *
 * O guia de autenticação do Next é explícito: a checagem no proxy é otimista
 * (só lê o cookie) e não serve como única defesa. Toda página que dependa de
 * identidade chama daqui, e a resposta da api é validada contra o contrato
 * compartilhado — se o back mudar a forma da sessão, isto falha alto.
 *
 * O `cache` do React deduplica a consulta dentro de um mesmo render.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const res = await apiFetch("/api/auth/get-session");
  if (!res.ok) return null;

  const parsed = sessionSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
});

/** Igual ao acima, mas manda para o login quem não estiver autenticado. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Organizações (fazendas/clínicas) das quais o usuário atual é membro. */
export const getOrganizations = cache(async (): Promise<Organization[]> => {
  const res = await apiFetch("/api/auth/organization/list");
  if (!res.ok) return [];

  const parsed = organizationListSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : [];
});

/**
 * Papel do usuário atual na organização informada (owner, admin, member).
 * `get-active-member` exigiria organização ativa na sessão; este endpoint
 * aceita o id explícito.
 */
export const getMemberRole = cache(
  async (organizationId: string): Promise<MemberRole | null> => {
    const res = await apiFetch(
      `/api/auth/organization/get-active-member-role?organizationId=${encodeURIComponent(organizationId)}`,
    );
    if (!res.ok) return null;

    const parsed = memberRoleSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  },
);

/** Rótulo em português do papel; o Better Auth usa owner/admin/member. */
export function rotuloPapel(role: string | undefined): string {
  switch (role) {
    case "owner":
    case "admin":
      return "Administrador";
    case "member":
      return "Membro";
    default:
      return "";
  }
}

/** Membros da organização com nome, e-mail, cargo e papel. */
export const getUsuarios = cache(
  async (organizationId: string): Promise<Usuario[]> => {
    const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/usuarios`);
    if (!res.ok) return [];

    const parsed = usuarioListaSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : [];
  },
);
