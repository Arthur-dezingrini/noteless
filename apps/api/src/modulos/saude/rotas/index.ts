import { Hono } from "hono";

import { consultasRoutes } from "./consultas";
import { prontuariosRoutes } from "./prontuarios";

/** Rotas do módulo saude, montadas em `/api/org`. */
export const saudeRotas = new Hono().route("/", consultasRoutes).route("/", prontuariosRoutes);
