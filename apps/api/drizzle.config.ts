import { defineConfig } from "drizzle-kit";

// drizzle-kit não lê .env sozinho; Node 24 carrega direto.
try {
  process.loadEnvFile(".env");
} catch {
  // Em CI as variáveis já vêm do ambiente.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
