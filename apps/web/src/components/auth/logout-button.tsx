"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { authClient } from "@/lib/auth/client";

/** `compacto`: só o ícone (rodapé do menu), com o rótulo para leitor de tela. */
export function LogoutButton({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={compacto ? (pending ? "Saindo" : "Sair") : undefined}
      title={compacto ? "Sair" : undefined}
      className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-field text-sm font-medium text-ink-muted transition hover:bg-hover hover:text-ink disabled:opacity-70 ${
        compacto ? "size-9 justify-center" : "px-3 py-2"
      }`}
    >
      <LogOut className="size-4" />
      {!compacto && (pending ? "Saindo..." : "Sair")}
    </button>
  );
}
