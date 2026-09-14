import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  clean: true,
  // O pacote compartilhado é TypeScript puro; empacotar junto evita ter que
  // compilá-lo separadamente no deploy.
  noExternal: ["@vocare/shared"],
});
