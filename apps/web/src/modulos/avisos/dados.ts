import "server-only";

import {
  notificacaoListaSchema,
  novidadesSchema,
  type Notificacao,
} from "@vocare/shared";
import { cache } from "react";

import { apiFetch } from "@/lib/api";
import { corpoJson } from "@/lib/json";

/** Buscas do módulo avisos na api, para páginas e layouts (server-only). */

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
