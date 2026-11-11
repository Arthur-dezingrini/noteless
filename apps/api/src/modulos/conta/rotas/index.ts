import { Hono } from "hono";

import { gravadoresOrgRoutes } from "./gravadores";
import { usuariosRoutes } from "./usuarios";

/** Rotas do módulo conta, montadas em `/api/org`. */
export const contaRotas = new Hono().route("/", usuariosRoutes).route("/", gravadoresOrgRoutes);
