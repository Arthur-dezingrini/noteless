import { Hono } from "hono";

import { galpoesRotas } from "./galpoes";
import { lotesRotas } from "./lotes";
import { registrosRotas } from "./registros";

/** Todas as rotas do aviário, montadas em `/api/org`. */
export const aviarioRotas = new Hono().route("/", galpoesRotas).route("/", lotesRotas).route("/", registrosRotas);
