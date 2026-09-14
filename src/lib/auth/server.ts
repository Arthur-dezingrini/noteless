import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
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
    // Precisa ser o último: é ele que grava os cookies nas Server Actions.
    nextCookies(),
  ],
});
