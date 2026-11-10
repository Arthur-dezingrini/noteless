import { Hono } from "hono";

import { notificacoesRoutes } from "./notificacoes";
import { novidadesRoutes } from "./novidades";

/** Rotas do módulo avisos, montadas em `/api/org`. */
export const avisosRotas = new Hono().route("/", notificacoesRoutes).route("/", novidadesRoutes);
