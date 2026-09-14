import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { db } from "./db";
import * as schema from "./db/schema";
import { env } from "./env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  // O front roda em outra origem. Sem isso o Better Auth rejeita o POST de
  // login como possível CSRF.
  trustedOrigins: [env.WEB_URL],

  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    // TODO(auth): ligar quando houver envio de e-mail (recuperação de senha).
    requireEmailVerification: false,
  },

  session: {
    // Um veterinário passa o dia em campo; sessão curta obrigaria login constante.
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // renova no máximo uma vez por dia
  },

  plugins: [
    // Multi-tenant: cada fazenda/clínica é uma organization; usuários são members.
    organization(),
  ],
});
