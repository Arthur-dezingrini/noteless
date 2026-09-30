/**
 * Entrada da api na Vercel (projeto com Root Directory `apps/api`).
 *
 * A Vercel procura a entrada do Hono por nome e, sem este arquivo, pegaria
 * src/app.ts — que ela copia arquivo a arquivo, com imports sem extensão, e o
 * Node não carrega. Aqui ela recebe o dist/index.js do tsup (o build roda
 * antes): um arquivo só, já com o @vocare/shared dentro.
 *
 * O import de "hono" é o que faz a Vercel reconhecer este arquivo como a
 * entrada. Local, nada usa isto: `npm run dev` roda src/index.ts.
 */
import "hono";

export { default } from "./dist/index.js";
