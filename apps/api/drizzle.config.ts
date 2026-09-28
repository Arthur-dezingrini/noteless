import { defineConfig } from "drizzle-kit";

// Mesmo seletor de ambiente da api: APP_ENV=hom → .env.hom.
import "./src/load-env";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema.ts", "./src/db/animais.ts", "./src/db/consultas.ts", "./src/db/ocorrencias.ts", "./src/db/historico.ts"],
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
