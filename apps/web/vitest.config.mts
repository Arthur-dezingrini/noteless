import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Testes de unidade: funções puras de src/ (datas, formatação) e os
// redirecionamentos do next.config. Telas ficam para testes no navegador, não aqui.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts", "next.config.test.ts"] },
});
