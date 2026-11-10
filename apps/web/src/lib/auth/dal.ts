import {
  avisoListaSchema,
  memberRoleSchema,
  notificacaoListaSchema,
  novidadesSchema,
  organizationListSchema,
  relatorioSchema,
  sessionSchema,
  usuarioListaSchema,
  type Aviso,
  type MemberRole,
  type Notificacao,
  type Organization,
  type Relatorio,
  type TipoRelatorio,
  type Session,
  type Usuario,
} from "@vocare/shared";
import { redirect } from "next/navigation";
import { cache } from "react";

import { apiFetch } from "@/lib/api";
import { corpoJson } from "@/lib/json";

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

  const parsed = sessionSchema.safeParse(await corpoJson(res));
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

  const parsed = organizationListSchema.safeParse(await corpoJson(res));
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

    const parsed = memberRoleSchema.safeParse(await corpoJson(res));
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

    const parsed = usuarioListaSchema.safeParse(await corpoJson(res));
    return parsed.success ? parsed.data : [];
  },
);

/** "Fique de olho" do Início: vacinas vencidas, consultas sem confirmar… */
export const getAvisos = cache(async (organizationId: string): Promise<Aviso[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/inicio/avisos`);
  if (!res.ok) return [];

  const parsed = avisoListaSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : [];
});

/** Um dos relatórios, para o período (e o animal, no de peso) pedido. */
export async function getRelatorio(
  organizationId: string,
  tipo: TipoRelatorio,
  params: { periodo?: string; animalId?: string },
): Promise<Relatorio | null> {
  const q = new URLSearchParams();
  if (params.periodo) q.set("periodo", params.periodo);
  if (params.animalId) q.set("animalId", params.animalId);
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/relatorios/${tipo}${q.size ? `?${q}` : ""}`);
  if (!res.ok) return null;

  const parsed = relatorioSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : null;
}

/** Avisos do sino do usuário atual nesta organização (os 30 mais recentes). */
export const getNotificacoes = cache(async (organizationId: string): Promise<Notificacao[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/notificacoes`);
  if (!res.ok) return [];

  const parsed = notificacaoListaSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : [];
});

/** Versão de "mudou alguma coisa?" no momento em que a tela é montada (ver AoVivo). */
export const getNovidades = cache(async (organizationId: string): Promise<string | null> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/novidades`);
  if (!res.ok) return null;

  const parsed = novidadesSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data.versao : null;
});

/**
 * Organização ativa do usuário: a que está na sessão (trocada pelo seletor
 * do menu lateral) ou, na falta dela, a primeira da lista. `null` só se o
 * usuário não pertence a nenhuma — o que, por regra, não deveria existir.
 */
export const getOrgAtiva = cache(async (): Promise<Organization | null> => {
  const [session, orgs] = await Promise.all([getSession(), getOrganizations()]);
  const ativaId = session?.session.activeOrganizationId;
  return orgs.find((o) => o.id === ativaId) ?? orgs[0] ?? null;
});
