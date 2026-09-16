import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { BrandShowcase } from "@/components/auth/brand-showcase";
import { Logo } from "@/components/auth/logo";
import { SignupForm } from "@/components/auth/signup-form";
import { getSession } from "@/lib/auth/dal";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta para gerenciar rebanho, manejo e atendimentos.",
};

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <BrandShowcase />

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-[21rem]">
          <Logo tone="dark" className="mb-10 lg:hidden" />

          <h1 className="text-[1.65rem] leading-tight font-bold tracking-tight text-ink">
            Crie sua conta
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Comece a gerenciar sua clínica ou fazenda
          </p>

          <div className="mt-8">
            <SignupForm />
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
