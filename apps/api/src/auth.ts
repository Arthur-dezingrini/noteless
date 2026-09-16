import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";

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
    // Não existe cadastro público: usuários são criados por um administrador
    // da organização (rota /api/org/:orgId/usuarios) ou pelo seed.
    disableSignUp: true,
    // TODO(auth): ligar quando houver envio de e-mail (recuperação de senha).
    requireEmailVerification: false,
  },

  user: {
    additionalFields: {
      // Função da pessoa na clínica/fazenda: Veterinária, Recepcionista, Peão…
      cargo: { type: "string", required: false, input: true },
    },
  },

  session: {
    // Um veterinário passa o dia em campo; sessão curta obrigaria login constante.
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // renova no máximo uma vez por dia
  },

  databaseHooks: {
    session: {
      create: {
        // Toda sessão nasce com uma organização ativa: a mais antiga do
        // usuário. O seletor no menu lateral troca depois (organization/set-active).
        before: async (session) => {
          const [m] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1);
          return { data: { ...session, activeOrganizationId: m?.organizationId ?? null } };
        },
      },
    },
  },

  plugins: [
    // Multi-tenant: cada fazenda/clínica é uma organization; usuários são members.
    organization(),
  ],
});
