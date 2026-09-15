import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/**
 * Escolhe qual arquivo de ambiente carregar.
 *
 *   npm run dev       → .env       (banco principal do time)
 *   npm run dev:hom   → .env.hom   (branch de homologação no Neon)
 *
 * A variável APP_ENV vem do script npm (via cross-env) e atravessa o Turborepo
 * porque está declarada em turbo.json. Sem arquivo, segue com o que o processo
 * já tem — é o caso em produção de verdade, onde as variáveis vêm da plataforma.
 *
 * O arquivo escolhido SOBRESCREVE variáveis já presentes no processo. Não é
 * gosto: o drizzle-kit embute o dotenv e carrega `.env` antes de rodar este
 * código, e `process.loadEnvFile` não sobrescreve nada — com ele, `.env.hom`
 * perdia para `.env` em silêncio e "migrar homologação" migrava o principal.
 */
export const APP_ENV = process.env.APP_ENV ?? "";
export const ENV_FILE = APP_ENV ? `.env.${APP_ENV}` : ".env";

try {
  Object.assign(process.env, parseEnv(readFileSync(ENV_FILE, "utf8")));
} catch {
  /* sem arquivo: variáveis já estão no ambiente */
}
