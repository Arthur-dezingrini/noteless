import {
  animalListaSchema,
  avisoListaSchema,
  consultaListaSchema,
  fichaAnimalSchema,
  fichaLoteSchema,
  galpaoHojeSchema,
  grupoListaSchema,
  instalacaoSchema,
  loteResumoSchema,
  memberRoleSchema,
  notificacaoListaSchema,
  novidadesSchema,
  ocorrenciaListaSchema,
  organizationListSchema,
  prontuarioListaSchema,
  relatorioSchema,
  sessionSchema,
  usuarioListaSchema,
  type Animal,
  type Aviso,
  type Consulta,
  type FichaAnimal,
  type FichaLote,
  type GalpaoHoje,
  type Grupo,
  type Instalacao,
  type LoteResumo,
  type MemberRole,
  type Notificacao,
  type Ocorrencia,
  type Organization,
  type Prontuario,
  type Relatorio,
  type TipoRelatorio,
  type Session,
  type Usuario,
} from "@vocare/shared";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

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

/** Animais cadastrados na organização, em ordem alfabética. */
export const getAnimais = cache(async (organizationId: string): Promise<Animal[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/animais`);
  if (!res.ok) return [];

  const parsed = animalListaSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : [];
});

/**
 * Consultas da organização, opcionalmente num intervalo de dias
 * ("AAAA-MM-DD"). Sem intervalo vem tudo — pequeno por muito tempo.
 */
export const getConsultas = cache(
  async (organizationId: string, de?: string, ate?: string): Promise<Consulta[]> => {
    const q = new URLSearchParams();
    if (de) q.set("de", de);
    if (ate) q.set("ate", ate);
    const sufixo = q.size ? `?${q}` : "";

    const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/consultas${sufixo}`);
    if (!res.ok) return [];

    const parsed = consultaListaSchema.safeParse(await corpoJson(res));
    return parsed.success ? parsed.data : [];
  },
);

/** Atendimentos registrados, do mais recente para o mais antigo. */
export const getProntuarios = cache(async (organizationId: string): Promise<Prontuario[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/prontuarios`);
  if (!res.ok) return [];

  const parsed = prontuarioListaSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : [];
});

/** Ficha do animal (cadastro + histórico + próximos + pendências); null se não existe. */
export const getFicha = cache(async (organizationId: string, animalId: string): Promise<FichaAnimal | null> => {
  const res = await apiFetch(
    `/api/org/${encodeURIComponent(organizationId)}/animais/${encodeURIComponent(animalId)}/ficha`,
  );
  if (!res.ok) return null;

  const parsed = fichaAnimalSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : null;
});

/** Grupos de animais da organização, com os ids dos membros. */
export const getGrupos = cache(async (organizationId: string): Promise<Grupo[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/grupos`);
  if (!res.ok) return [];

  const parsed = grupoListaSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : [];
});

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

/** Registros de ocorrência da organização, mais recentes primeiro. */
export const getOcorrencias = cache(async (organizationId: string): Promise<Ocorrencia[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/ocorrencias`);
  if (!res.ok) return [];

  const parsed = ocorrenciaListaSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : [];
});

/** Instalações (galpões, pastos, baias) da organização, com o lote atual de cada uma. */
export const getInstalacoes = cache(async (organizationId: string): Promise<Instalacao[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/instalacoes`);
  if (!res.ok) return [];

  const parsed = z.array(instalacaoSchema).safeParse(await res.json());
  return parsed.success ? parsed.data : [];
});

/** Galpões com lote alojado e se já foram apontados hoje. */
export const getGalpoesHoje = cache(async (organizationId: string): Promise<GalpaoHoje[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/galpoes-hoje`);
  if (!res.ok) return [];

  const parsed = z.array(galpaoHojeSchema).safeParse(await res.json());
  return parsed.success ? parsed.data : [];
});

/** Lotes da organização, ativos ou encerrados. */
export const getLotes = cache(
  async (organizationId: string, situacao: "ativo" | "encerrado"): Promise<LoteResumo[]> => {
    const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/lotes?situacao=${situacao}`);
    if (!res.ok) return [];

    const parsed = z.array(loteResumoSchema).safeParse(await res.json());
    return parsed.success ? parsed.data : [];
  },
);

/** Ficha do lote (cadastro, galpões, indicadores); null se não existe. */
export const getLote = cache(async (organizationId: string, id: string): Promise<FichaLote | null> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/lotes/${encodeURIComponent(id)}`);
  if (!res.ok) return null;

  const parsed = fichaLoteSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
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
