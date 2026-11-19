import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/auth/logo";
import { NovaSenhaForm } from "@/modulos/conta";

export const metadata: Metadata = {
  title: "Senha nova",
};

/**
 * Destino do link do e-mail. A api confere o token antes de mandar para cá:
 * chega `?token=` quando vale e `?error=INVALID_TOKEN` quando venceu.
 */
export default async function RedefinirSenhaPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const { token, error } = await searchParams;
  const tokenValido = typeof token === "string" && token && !error ? token : null;

  return (
    <main className="flex min-h-svh flex-col justify-center bg-page px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-[22rem] flex-col gap-7">
        <Logo />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Senha nova</h1>
          <p className="text-base text-ink-muted">
            {tokenValido ? "Escolha a senha que você vai usar para entrar." : "Este link venceu ou já foi usado."}
          </p>
        </div>
        {tokenValido ? (
          <NovaSenhaForm token={tokenValido} />
        ) : (
          <Link href="/esqueci-senha" className="text-sm font-semibold text-brand-ink hover:underline">
            Pedir outro link
          </Link>
        )}
        <Link href="/login" className="text-sm font-semibold text-brand-ink hover:underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
