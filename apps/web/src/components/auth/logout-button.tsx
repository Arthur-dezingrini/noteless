"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { authClient } from "@/lib/auth/client";

export function LogoutButton() {
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
      className="flex cursor-pointer items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-black/5 hover:text-ink disabled:opacity-70"
    >
      <LogOut className="size-4" />
      {pending ? "Saindo..." : "Sair"}
    </button>
  );
}
