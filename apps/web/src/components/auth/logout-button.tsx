"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { authClient } from "@/lib/auth/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function sair() {
    startTransition(async () => {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={pending}
      className="shrink-0 cursor-pointer rounded-md p-1 text-sm font-semibold text-ink-muted transition hover:text-ink disabled:opacity-70"
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
