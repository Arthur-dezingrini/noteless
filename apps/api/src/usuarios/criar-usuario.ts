import { auth } from "../auth";

/**
 * Cria um usuário com e-mail e senha SEM passar pelo sign-up público (que
 * está desligado). Replica o que o endpoint de sign-up do Better Auth faz
 * por dentro: hash da senha pelo algoritmo dele + conta "credential".
 *
 * Usado pelo seed e pela rota de administração de usuários.
 */
export async function criarUsuario(input: {
  name: string;
  email: string;
  password: string;
  cargo?: string;
}) {
  const ctx = await auth.$context;
  const email = input.email.trim().toLowerCase();

  const existente = await ctx.internalAdapter.findUserByEmail(email);
  if (existente) {
    throw new UsuarioJaExiste(email);
  }

  const hash = await ctx.password.hash(input.password);
  const user = await ctx.internalAdapter.createUser(
    { name: input.name, email, emailVerified: false, cargo: input.cargo ?? null },
    { method: "email-password" },
  );

  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });

  return user;
}

export class UsuarioJaExiste extends Error {
  constructor(email: string) {
    super(`Já existe um usuário com o e-mail ${email}.`);
    this.name = "UsuarioJaExiste";
  }
}
