import {
  AudioLines,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  PawPrint,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Fonte única do menu lateral. Ordem aqui = ordem na tela. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/animais", label: "Animais", icon: PawPrint },
  { href: "/prontuarios", label: "Prontuários", icon: BookOpen },
  { href: "/ocorrencias", label: "Registros de Ocorrências", icon: AudioLines },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
