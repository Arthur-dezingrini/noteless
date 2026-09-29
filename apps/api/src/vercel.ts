/**
 * Entrada na Vercel. Lá a api roda como função: a plataforma chama o `app`
 * exportado, sem servidor próprio (o `serve()` de index.ts é só para rodar
 * local e em servidor comum). O tsup empacota isto em dist/vercel.js, já com
 * o @vocare/shared dentro — ver vercel.json na raiz.
 */
import "hono";
import { app } from "./app";

export default app;
