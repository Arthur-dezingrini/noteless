import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { auth } from "./auth";
import { origensConfiaveis } from "./env";
import { aviarioRotas } from "./modulos/aviario";
import { notasRotas } from "./modulos/notas";
import { animaisRotas } from "./modulos/animais";
import { saudeRotas } from "./modulos/saude";
import { adminRotas, contaRotas, perfilRotas } from "./modulos/conta";
import { avisosRotas } from "./modulos/avisos";
import { painelRotas } from "./modulos/painel";

export const app = new Hono();

app.use(logger());

// Só o front tem permissão de chamar com cookies. Um webhook do WhatsApp, por
// exemplo, não manda Origin e passa direto por aqui sem precisar de CORS.
app.use(
  "/api/*",
  cors({
    origin: origensConfiaveis,
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
app.route("/api/org", contaRotas);
app.route("/api/org", animaisRotas);
app.route("/api/org", saudeRotas);
app.route("/api/org", notasRotas);
app.route("/api/org", aviarioRotas);
app.route("/api/org", avisosRotas);
app.route("/api/org", painelRotas);
app.route("/api/perfil", perfilRotas);
app.route("/api/admin", adminRotas);
