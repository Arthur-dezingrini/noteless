"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { APIError } from "better-auth/api";

import { loginSchema } from "./schema";
import { auth } from "./server";

export type LoginState = {
  fieldErrors?: { email?: string; password?: string };
  formError?: string;
};

/**
 * Só aceita caminho interno. Sem isso, `?next=https://site-falso` transformaria
 * o login num redirecionador aberto.
 */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  if (typeof valor !== "string") return "/dashboard";
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/dashboard";
  return valor;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        email: flattened.email?.[0],
        password: flattened.password?.[0],
      },
    };
  }

  try {
    // O plugin nextCookies grava o cookie de sessão a partir daqui.
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      // Mensagem única de propósito: dizer "esse e-mail não existe" entrega a
      // quem está sondando quais contas são válidas.
      return { formError: "E-mail ou senha incorretos." };
    }
    console.error("[login] falha inesperada", error);
    return { formError: "Não foi possível entrar agora. Tente de novo." };
  }

  // redirect() lança uma exceção de controle — precisa ficar fora do try.
  redirect(destinoSeguro(formData.get("next")));
}

export async function logout() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
