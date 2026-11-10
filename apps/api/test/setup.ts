import { fileURLToPath } from "node:url";

import { vi } from "vitest";

/**
 * Troca o `db` da api (Neon por WebSocket) por um Postgres em memória com as
 * mesmas migrações. Tudo que importa `../db` — rotas e Better Auth — passa a
 * usar este banco. Cada arquivo de teste ganha um banco novo e vazio.
 */
vi.mock("../src/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = {
    ...(await import("../src/db/schema")),
    ...(await import("../src/db/tabelas/animais")),
    ...(await import("../src/db/tabelas/saude")),
    ...(await import("../src/db/tabelas/notas")),
    ...(await import("../src/db/tabelas/historico")),
    ...(await import("../src/db/tabelas/avisos")),
    ...(await import("../src/db/tabelas/aviario")),
  };

  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  return { db };
});
