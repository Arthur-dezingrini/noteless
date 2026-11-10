import type { Route } from "next";

/**
 * Formato do menu que cada módulo declara em `modulos/<m>/menu.ts`. Fica
 * separado de `navigation.ts` (que importa os menus) para não fechar ciclo.
 */
export type Tela = { id: string; rotulo: string; href: Route; emBreve?: true; soComInstalacao?: true };
export type ModuloMenu = { id: string; rotulo: string; href?: Route; telas: Tela[]; emBreve?: true };

/** Endereço da página "em breve" de uma tela ou módulo que ainda não existe. */
export function emBreve(id: string): Route {
  return `/em-breve?tela=${id}` as Route;
}
