import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";

import { db } from "./db";
import * as schema from "./db/schema";
import { env, origensConfiaveis } from "./env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  // O front roda em outra origem. Sem isso o Better Auth rejeita o POST de
  // login como possível CSRF.
  trustedOrigins: origensConfiaveis,
  // Origem conferida também nos testes (o padrão do Better Auth é pular com
  // NODE_ENV=test): assim eles cobrem o CSRF e o destino dos links de e-mail.
  advanced: { disableOriginCheck: false },

  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    // Não existe cadastro público: usuários são criados por um administrador
    // da organização (rota /api/org/:orgId/usuarios) ou pelo seed.
    disableSignUp: true,
    // Continua desligado: as contas já criadas nunca confirmaram o e-mail e
    // deixariam de entrar.
    requireEmailVerification: false,
    // "Esqueci a senha": o link vai por e-mail, vale 1 hora e serve uma vez.
    // Import dinâmico porque o módulo conta importa este arquivo; o estático
    // fecharia um ciclo na carga.
    sendResetPassword: async ({ user, url }) => {
      const { enviarLinkDeSenha } = await import("./modulos/conta");
      await enviarLinkDeSenha(user, url);
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    // Senha redefinida derruba as sessões abertas: aparelho perdido, senha vazada.
    revokeSessionsOnPasswordReset: true,
    // A senha nova vale na hora, mesmo com o e-mail travado por tentativas erradas.
    onPasswordReset: async ({ user }) => {
      const { zerarFalhas } = await import("./modulos/conta");
      await zerarFalhas(user.email);
    },
  },

  user: {
    additionalFields: {
      // Função da pessoa na clínica/fazenda: Veterinária, Recepcionista, Peão…
      cargo: { type: "string", required: false, input: true },
      // "comum" ou "super". Super usuário vincula qualquer pessoa a qualquer
      // empresa (/api/admin). `input: false`: ninguém se marca sozinho, nem no
      // cadastro nem no update do próprio perfil.
      tipo: { type: "string", required: false, defaultValue: "comum", input: false },
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
    organization({
      // Organização nova só pelo servidor (seed). Quem cria vira dono, e dono
      // vincula qualquer conta pelo e-mail — não pode ficar aberto a quem loga.
      allowUserToCreateOrganization: false,
    }),
  ],
});
