import type { ModuloMenu } from "@/lib/menu-tipos";

export const menu: ModuloMenu = {
  id: "saude",
  rotulo: "Saúde",
  telas: [
    { id: "saude.agenda", rotulo: "Agenda", href: "/saude/agenda" },
    { id: "saude.prontuarios", rotulo: "Prontuários", href: "/saude/prontuarios" },
  ],
};
