import "server-only";

import {
  avisoListaSchema,
  relatorioSchema,
  type Aviso,
  type Relatorio,
  type TipoRelatorio,
} from "@vocare/shared";
import { cache } from "react";

import { apiFetch } from "@/lib/api";
import { corpoJson } from "@/lib/json";

/** Buscas do módulo painel na api, para páginas e layouts (server-only). */

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
