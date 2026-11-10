import { emBreve, type ModuloMenu } from "@/lib/menu-tipos";

export const menu: ModuloMenu = {
  id: "aviario",
  rotulo: "Aviário",
  telas: [
    { id: "aviario.lotes", rotulo: "Lotes", href: "/aviario/lotes", soComInstalacao: true },
    { id: "aviario.galpoes", rotulo: "Galpões", href: "/aviario/galpoes" },
    { id: "aviario.incubatorio", rotulo: "Incubatório", href: emBreve("aviario.incubatorio"), emBreve: true },
  ],
};
