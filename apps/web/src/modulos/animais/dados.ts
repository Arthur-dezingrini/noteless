import "server-only";

import {
  animalListaSchema,
  fichaAnimalSchema,
  grupoListaSchema,
  type Animal,
  type FichaAnimal,
  type Grupo,
} from "@vocare/shared";
import { cache } from "react";

import { apiFetch } from "@/lib/api";
import { corpoJson } from "@/lib/json";

/** Buscas do módulo animais na api, para páginas e layouts (server-only). */

/** Animais cadastrados na organização, em ordem alfabética. */
export const getAnimais = cache(async (organizationId: string): Promise<Animal[]> => {
  const res = await apiFetch(`/api/org/${encodeURIComponent(organizationId)}/animais`);
  if (!res.ok) return [];

  const parsed = animalListaSchema.safeParse(await corpoJson(res));
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
