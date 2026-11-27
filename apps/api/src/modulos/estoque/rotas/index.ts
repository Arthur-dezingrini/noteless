import { Hono } from "hono";

import { cadastrosRotas } from "./cadastros";
import { inventarioRotas } from "./inventario";
import { lancamentosRotas } from "./lancamentos";
import { nfeRotas } from "./nfe";

/** Todas as rotas do estoque, montadas em `/api/org` com o prefixo `/:orgId/estoque`. */
export const estoqueRotas = new Hono().route("/", cadastrosRotas).route("/", lancamentosRotas).route("/", inventarioRotas).route("/", nfeRotas);
