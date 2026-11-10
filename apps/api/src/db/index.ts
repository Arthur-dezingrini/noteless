import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "../env";
import * as schema from "./schema";
import * as animais from "./tabelas/animais";
import * as aviario from "./tabelas/aviario";
import * as avisos from "./tabelas/avisos";
import * as historico from "./tabelas/historico";
import * as notas from "./tabelas/notas";
import * as saude from "./tabelas/saude";

/**
 * Driver do Neon em vez de `pg`: fala com o banco por WebSocket na porta 443.
 * A 5432 é bloqueada em muitas redes (universidade, empresa) — com este
 * driver o projeto roda em qualquer lugar sem VPN. Node 24 já traz WebSocket
 * nativo, então não precisa de `ws`.
 *
 * Consequência: só conecta em Neon (ou outro Postgres atrás de um proxy
 * WebSocket). Se um dia precisar de Postgres local, volte para
 * `drizzle-orm/node-postgres` + `pg` — são estas quatro linhas.
 */
const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema: { ...schema, ...animais, ...saude, ...notas, ...historico, ...avisos, ...aviario } });
