import { serve } from "@hono/node-server";

import { app } from "./app";
import { env } from "./env";
import { APP_ENV, ENV_FILE } from "./load-env";

// Só o host, nunca a credencial.
const dbHost = new URL(env.DATABASE_URL).hostname;

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api ouvindo em http://localhost:${info.port}`);
  console.log(`ambiente: ${APP_ENV || "principal"} (${ENV_FILE}) — banco: ${dbHost}`);
});
