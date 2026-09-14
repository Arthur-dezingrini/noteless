import { defineConfig } from "drizzle-kit";

// Mesmo seletor de ambiente da api: APP_ENV=hom → .env.hom.
import "./src/load-env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
