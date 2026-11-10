import "server-only";

import {
  usuarioListaSchema,
  type Usuario,
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
