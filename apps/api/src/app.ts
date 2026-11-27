import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";

import { auth } from "./auth";
import { alertar, mensagemDe, orgDaRota } from "./base/alerta";
import { db } from "./db";
import { origensConfiaveis } from "./env";
import { aviarioRotas } from "./modulos/aviario";
import { notasRotas, rotinasRotas } from "./modulos/notas";
import { animaisRotas } from "./modulos/animais";
import { saudeRotas } from "./modulos/saude";
import { adminRotas, contaRotas, gravadoresAdminRotas, gravadoresRotas, perfilRotas, protegerLogin, termosRotas } from "./modulos/conta";
import { avisosRotas } from "./modulos/avisos";
import { estoqueRotas } from "./modulos/estoque";
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

// Vigiado de fora (UptimeRobot/Better Stack) e nunca vem de cache. Sem ?banco
// não acorda o Neon: o vigia de 5 em 5 min fica aqui, e o ?banco=1, que roda
// `select 1`, vai num vigia bem mais espaçado.
app.get("/health", async (c) => {
  c.header("Cache-Control", "no-store");
  if (c.req.query("banco") === undefined) return c.json({ ok: true });
  try {
    await db.execute(sql`select 1`);
    return c.json({ ok: true, banco: "ok" });
  } catch (e) {
    console.error("[health] banco fora:", e);
    return c.json({ ok: false, banco: "falhou" }, 503);
  }
});

// Erro que nenhuma rota tratou: avisa por e-mail e responde JSON, como o resto da api.
app.onError(async (err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error("[api] erro não tratado:", err);
  await alertar("erro-api", { mensagem: mensagemDe(err), rota: `${c.req.method} ${c.req.path}`, orgId: orgDaRota(c.req.path) });
  return c.json({ error: "Erro interno." }, 500);
});

// Login por e-mail e senha passa antes pelo freio de tentativas erradas
// (modulos/conta/regras/tentativas-login.ts).
app.post("/api/auth/sign-in/email", (c) => protegerLogin(c.req.raw, (req) => auth.handler(req)));

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
app.route("/api/org", estoqueRotas);
app.route("/api/org", painelRotas);
app.route("/api/perfil", perfilRotas);
app.route("/api/perfil/termos", termosRotas);
app.route("/api/admin", adminRotas);
app.route("/api/admin/gravadores", gravadoresAdminRotas);
app.route("/api/gravadores", gravadoresRotas);
app.route("/api/rotinas", rotinasRotas);
