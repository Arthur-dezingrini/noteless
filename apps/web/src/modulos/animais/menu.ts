import { emBreve, type ModuloMenu } from "@/lib/menu-tipos";

export const menu: ModuloMenu = {
  id: "animais",
  rotulo: "Animais",
  telas: [
    { id: "animais.cadastro", rotulo: "Cadastro", href: "/animais" },
    { id: "animais.grupos", rotulo: "Grupos", href: "/animais/grupos" },
    { id: "animais.especies", rotulo: "Espécies", href: emBreve("animais.especies"), emBreve: true },
    { id: "animais.historico", rotulo: "Histórico", href: emBreve("animais.historico"), emBreve: true },
  ],
};
