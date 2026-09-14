import type { Metadata } from "next";

import { BrandShowcase } from "@/components/auth/brand-showcase";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/auth/logo";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta para gerenciar rebanho, manejo e atendimentos.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Painel de apresentação: só faz sentido onde há largura para ele. */}
      <BrandShowcase />

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[21rem]">
          {/* Sem o painel verde no mobile, a marca precisa aparecer aqui. */}
          <Logo tone="dark" className="mb-10 lg:hidden" />

          <h1 className="text-[1.65rem] leading-tight font-bold tracking-tight text-ink">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Entre na sua conta para continuar
          </p>

          <div className="mt-8">
            <LoginForm next={typeof next === "string" ? next : undefined} />
          </div>

          <p className="mt-10 text-center text-xs text-ink-muted">
            © {new Date().getFullYear()} {BRAND_NAME} · Todos os direitos
            reservados
          </p>
        </div>
      </div>
    </main>
  );
}
