"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button, FormMessage } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

const link = "font-semibold text-brand-ink hover:underline";

/** Aceite dos Termos de Uso e da Política de Privacidade da versão atual, antes de entrar. */
export function AceiteForm({ versao }: { versao: string }) {
  const router = useRouter();
  const [marcado, setMarcado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function aceitar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const err = await chamarApi("/api/perfil/termos", { method: "POST", body: JSON.stringify({ versao }) });
      if (err) {
        setErro(err);
        return;
      }
      router.replace("/dashboard");
    });
  }

  return (
    <form onSubmit={aceitar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Antes de continuar</h1>
        <p className="text-base text-ink-muted">
          Leia os{" "}
          <Link href="/termos" target="_blank" className={link}>
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className={link}>
            Política de Privacidade
          </Link>
          . Eles explicam o que o sistema guarda, por quanto tempo e com quem compartilha.
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[15px] text-ink">
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} className="mt-1 size-4" />
        Li e aceito os Termos de Uso e a Política de Privacidade
      </label>
      {erro && <FormMessage>{erro}</FormMessage>}
      <Button type="submit" variant="primario" loading={pending} disabled={!marcado}>
        Continuar
      </Button>
    </form>
  );
}
