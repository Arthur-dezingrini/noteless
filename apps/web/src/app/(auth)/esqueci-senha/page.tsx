import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/auth/logo";
import { EsqueciSenhaForm } from "@/modulos/conta";

export const metadata: Metadata = {
  title: "Esqueci a senha",
};

export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-svh flex-col justify-center bg-page px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-[22rem] flex-col gap-7">
        <Logo />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Esqueci a senha</h1>
          <p className="text-base text-ink-muted">Informe o e-mail da sua conta para receber um link e criar uma senha nova.</p>
        </div>
        <EsqueciSenhaForm />
        <p className="text-sm text-ink-soft">Sem acesso ao e-mail? Peça ao administrador da sua fazenda para definir uma senha nova.</p>
        <Link href="/login" className="text-sm font-semibold text-brand-ink hover:underline">
          Voltar para o login
        </Link>
      </div>
    </main>
  );
}
