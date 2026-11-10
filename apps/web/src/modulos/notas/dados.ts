import "server-only";

import { ocorrenciaListaSchema, type Ocorrencia } from "@vocare/shared";
import { cache } from "react";

import { apiFetch } from "@/lib/api";
import { corpoJson } from "@/lib/json";

/** Buscas das notas na api, para páginas e layouts (server-only). */

/** Registros de ocorrência da organização, mais recentes primeiro. */
export const getOcorrencias = cache(async (organizationId: string): Promise<Ocorrencia[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/ocorrencias`);
  if (!res.ok) return [];

  const parsed = ocorrenciaListaSchema.safeParse(await corpoJson(res));
  return parsed.success ? parsed.data : [];
});
