import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { auth } from "./auth";
import { env } from "./env";

export const app = new Hono();

app.use(logger());

// Só o front tem permissão de chamar com cookies. Um webhook do WhatsApp, por
// exemplo, não manda Origin e passa direto por aqui sem precisar de CORS.
app.use(
  "/api/*",
  cors({
    origin: env.WEB_URL,
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

// Todo o ciclo de autenticação (sign-in, sign-out, get-session, organizations…)
// é servido pelo Better Auth a partir daqui.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// As rotas de negócio (rebanho, capturas de voz, sugestões) entram abaixo.
