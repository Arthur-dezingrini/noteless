/**
 * Escolhe qual arquivo de ambiente carregar.
 *
 *   npm run dev       → .env       (banco principal do time)
 *   npm run dev:hom   → .env.hom   (branch de homologação no Neon)
 *
 * A variável APP_ENV vem do script npm (via cross-env) e atravessa o Turborepo
 * porque está declarada em turbo.json. Sem arquivo, segue com o que o processo
 * já tem — é o caso em produção de verdade, onde as variáveis vêm da plataforma.
 */
export const APP_ENV = process.env.APP_ENV ?? "";
export const ENV_FILE = APP_ENV ? `.env.${APP_ENV}` : ".env";

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  /* sem arquivo: variáveis já estão no ambiente */
}
