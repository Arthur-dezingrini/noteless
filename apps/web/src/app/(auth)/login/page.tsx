import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/auth/logo";
import { getSession } from "@/lib/auth/dal";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Conte o que aconteceu com seus animais e o sistema anota por você.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  // Checagem real (na api), não pelo cookie: um cookie velho não pode expulsar
  // ninguém daqui — é justamente quem precisa logar de novo.
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="flex min-h-svh bg-page">
      {/* Painel de apresentação: só onde há largura para ele. */}
      <section className="hidden flex-1 flex-col justify-between bg-surface px-14 py-12 lg:flex">
        <Logo />
        <div className="flex max-w-[30rem] flex-col gap-4">
          <p className="text-[34px] leading-tight font-semibold tracking-tight text-balance text-ink">
            Conte o que aconteceu com seus animais. O {BRAND_NAME} anota por você.
          </p>
          <p className="text-[17px] leading-relaxed text-ink-soft">
            Tudo que for falado no microfone do {BRAND_NAME} chega aqui escrito. Vacinas, pesagens e consultas vão direto para o histórico de
            cada animal.
          </p>
        </div>
        <p className="text-[15px] text-ink-muted">Para quem cuida de um animal ou de mil.</p>
      </section>

      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto flex w-full max-w-[22rem] flex-col gap-7">
          <Logo className="lg:hidden" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Entrar</h1>
            <p className="text-base text-ink-muted">Use o e-mail que você cadastrou.</p>
          </div>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </div>
    </main>
  );
}
