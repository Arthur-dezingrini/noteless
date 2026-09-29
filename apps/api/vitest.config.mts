import { defineConfig } from "vitest/config";

/**
 * Testes das rotas contra um Postgres em memória (PGlite) — ver
 * test/setup.ts. Nada aqui fala com o Neon nem com a IA.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // Cada arquivo sobe o próprio banco e roda as migrações: leva uns segundos.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      // APP_ENV=test aponta para .env.test, que não existe: o .env de
      // verdade (banco, chave da IA) nunca é carregado nos testes.
      APP_ENV: "test",
      NODE_ENV: "test",
      DATABASE_URL: "postgres://teste@localhost:5432/teste", // não usado: o db é trocado
      BETTER_AUTH_SECRET: "segredo-so-para-teste-nao-use-em-producao",
      BETTER_AUTH_URL: "http://localhost:4000",
      WEB_URL: "http://localhost:3000",
      GROQ_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      TRANSCRICAO_API_KEY: "",
    },
  },
});
