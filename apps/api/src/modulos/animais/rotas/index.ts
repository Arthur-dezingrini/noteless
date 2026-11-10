import { Hono } from "hono";

import { animaisRoutes } from "./animais";
import { fichaRoutes } from "./ficha";
import { gruposRoutes } from "./grupos";

/** Rotas do módulo animais, montadas em `/api/org`. */
export const animaisRotas = new Hono().route("/", animaisRoutes).route("/", fichaRoutes).route("/", gruposRoutes);
