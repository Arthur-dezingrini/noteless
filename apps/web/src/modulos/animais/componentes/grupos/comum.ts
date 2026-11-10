import { ROTULO_ESPECIE, type Especie, type Grupo } from "@vocare/shared";

export const MISTURADO = "misturado";

export function rotuloEspecie(e: string | null | undefined) {
  if (!e) return null;
  return e === MISTURADO ? "Misturado" : (ROTULO_ESPECIE[e as Especie] ?? e);
}

/** Corpo do PATCH/POST: o grupo inteiro, com a lista final de membros. */
export function corpo(g: Pick<Grupo, "nome" | "descricao" | "especie" | "local">, animalIds: string[]) {
  return JSON.stringify({ nome: g.nome, descricao: g.descricao ?? null, especie: g.especie ?? null, local: g.local ?? null, animalIds });
}
