import { Hono } from "hono";

import { inicioRoutes } from "./inicio";
import { relatoriosRoutes } from "./relatorios";

/** Rotas do módulo painel, montadas em `/api/org`. */
export const painelRotas = new Hono().route("/", inicioRoutes).route("/", relatoriosRoutes);
