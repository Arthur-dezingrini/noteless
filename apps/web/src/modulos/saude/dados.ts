import "server-only";

import {
  consultaListaSchema,
  prontuarioListaSchema,
  type Consulta,
  type Prontuario,
} from "@vocare/shared";
import { cache } from "react";

import { apiFetch } from "@/lib/api";
import { corpoJson } from "@/lib/json";

/** Buscas do módulo saude na api, para páginas e layouts (server-only). */

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
