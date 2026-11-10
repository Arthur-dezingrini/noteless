import { Hono } from "hono";

import { usuariosRoutes } from "./usuarios";

/** Rotas do módulo conta, montadas em `/api/org`. */
export const contaRotas = new Hono().route("/", usuariosRoutes);
