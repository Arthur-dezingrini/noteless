import "server-only";

import {
  fichaLoteSchema,
  galpaoHojeSchema,
  instalacaoSchema,
  loteResumoSchema,
  type FichaLote,
  type GalpaoHoje,
  type Instalacao,
  type LoteResumo,
} from "@vocare/shared";
import { cache } from "react";
import { z } from "zod";

import { apiFetch } from "@/lib/api";

/** Buscas do aviário na api, para páginas e layouts (server-only). */

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
