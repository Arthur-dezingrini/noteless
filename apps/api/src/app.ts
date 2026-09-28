import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { auth } from "./auth";
import { env } from "./env";
import { animaisRoutes } from "./routes/animais";
import { consultasRoutes } from "./routes/consultas";
import { gruposRoutes } from "./routes/grupos";
import { ocorrenciasRoutes } from "./routes/ocorrencias";
import { perfilRoutes } from "./routes/perfil";
import { usuariosRoutes } from "./routes/usuarios";

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

// Rotas de negócio. Cada uma valida sessão e papel por conta própria.
app.route("/api/org", usuariosRoutes);
app.route("/api/org", animaisRoutes);
app.route("/api/org", consultasRoutes);
app.route("/api/org", ocorrenciasRoutes);
app.route("/api/org", gruposRoutes);
app.route("/api/perfil", perfilRoutes);
