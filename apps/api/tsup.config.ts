import { defineConfig } from "tsup";

export default defineConfig({
  // index: servidor Node comum (npm start). Na Vercel, ela usa src/index.ts direto.
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node24",
  clean: true,
  // Cada entrada num arquivo só: a função da Vercel não depende de chunk solto.
  splitting: false,
  // O pacote compartilhado é TypeScript puro; empacotar junto evita ter que
  // compilá-lo separadamente no deploy.
  noExternal: ["@vocare/shared"],
});
