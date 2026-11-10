import { menu as animais } from "@/modulos/animais/menu";
import { menu as aviario } from "@/modulos/aviario/menu";
import { configuracoes } from "@/modulos/conta/menu";
import { menu as estoque } from "@/modulos/estoque/menu";
import { menu as financeiro } from "@/modulos/financeiro/menu";
import { menu as notas } from "@/modulos/notas/menu";
import { inicio, relatorios } from "@/modulos/painel/menu";
import { menu as saude } from "@/modulos/saude/menu";

import { emBreve, type ModuloMenu, type Tela } from "./menu-tipos";

export { emBreve, type ModuloMenu, type Tela };

/**
 * Menu lateral: os módulos, na ordem da tela. Cada módulo declara o próprio
 * menu em `modulos/<m>/menu.ts`; módulo novo entra aqui, tela nova entra no
 * menu dele (com `emBreve` enquanto não existe).
 */
export const MENU: ModuloMenu[] = [inicio, notas, animais, aviario, saude, estoque, financeiro, relatorios];

/** Fica no rodapé do menu, junto do usuário (só administrador). */
export const RODAPE: ModuloMenu[] = [configuracoes];

const semQuery = (href: string) => href.split("?")[0]!;
const casa = (caminho: string, href: string) => caminho === href || caminho.startsWith(`${href}/`);

/**
 * Módulo e tela do endereço atual. Na página "em breve", `usePathname` não
 * traz a query: quem chama passa o `?tela=` em `telaEmBreve`.
 */
export function acharAtivo(
  pathname: string,
  telaEmBreve?: string | null,
  menu: ModuloMenu[] = [...MENU, ...RODAPE],
): { modulo: ModuloMenu; tela: Tela | null } | null {
  if (pathname === "/em-breve") {
    for (const modulo of menu) {
      if (modulo.id === telaEmBreve) return { modulo, tela: null };
      const tela = modulo.telas.find((t) => t.id === telaEmBreve);
      if (tela) return { modulo, tela };
    }
    return null;
  }
  let melhor: { modulo: ModuloMenu; tela: Tela; tamanho: number } | null = null;
  for (const modulo of menu) {
    for (const tela of modulo.telas) {
      if (tela.emBreve) continue;
      const href = semQuery(tela.href);
      if (casa(pathname, href) && href.length > (melhor?.tamanho ?? -1)) melhor = { modulo, tela, tamanho: href.length };
    }
  }
  if (melhor) return { modulo: melhor.modulo, tela: melhor.tela };
  const modulo = menu.find((m) => m.href && !m.emBreve && casa(pathname, semQuery(m.href)));
  return modulo ? { modulo, tela: null } : null;
}

/** Tira as telas que dependem de galpão cadastrado quando a organização não tem. */
export function menuVisivel(menu: ModuloMenu[], { temInstalacao }: { temInstalacao: boolean }): ModuloMenu[] {
  return menu.map((m) => ({ ...m, telas: m.telas.filter((t) => !t.soComInstalacao || temInstalacao) }));
}

/** Problemas do registro: id repetido, tela sem o prefixo do módulo, em breve apontando para outro lugar. */
export function validarMenu(menu: ModuloMenu[]): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();
  const unico = (id: string) => {
    if (vistos.has(id)) problemas.push(`id repetido: ${id}`);
    vistos.add(id);
  };
  for (const m of menu) {
    unico(m.id);
    if (m.emBreve && m.href !== emBreve(m.id)) problemas.push(`${m.id}: em breve deve apontar para ${emBreve(m.id)}`);
    if (!m.href && m.telas.length === 0) problemas.push(`${m.id}: sem endereço e sem telas`);
    for (const t of m.telas) {
      unico(t.id);
      if (!t.id.startsWith(`${m.id}.`)) problemas.push(`${t.id}: deve começar com "${m.id}."`);
      if (t.emBreve && t.href !== emBreve(t.id)) problemas.push(`${t.id}: em breve deve apontar para ${emBreve(t.id)}`);
    }
  }
  return problemas;
}
