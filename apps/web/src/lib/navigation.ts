import type { Route } from "next";

export type NavItem = {
  href: Route;
  label: string;
  /** Só aparece quando a organização tem ao menos uma instalação cadastrada. */
  soComInstalacao?: boolean;
};

/**
 * Fonte única do menu lateral. Ordem aqui = ordem na tela. Sem ícones: o menu
 * é curto e os rótulos bastam.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Início" },
  { href: "/agenda", label: "Agenda" },
  { href: "/animais", label: "Animais" },
  { href: "/lotes", label: "Lotes", soComInstalacao: true },
  { href: "/grupos", label: "Grupos" },
  { href: "/prontuarios", label: "Prontuários" },
  { href: "/notas", label: "Notas" },
  { href: "/relatorios", label: "Relatórios" },
];

/** Fica no rodapé do menu, junto do usuário. */
export const NAV_RODAPE: NavItem[] = [{ href: "/configuracoes", label: "Configurações" }];
