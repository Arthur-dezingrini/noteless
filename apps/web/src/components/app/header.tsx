import { Bell } from "lucide-react";
import Link from "next/link";
import type { Session } from "@vocare/shared";

import { LogoutButton } from "@/components/auth/logout-button";

import { Avatar } from "./avatar";

export function Header({
  user,
  papel,
}: {
  user: Session["user"];
  papel: string;
}) {
  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-line bg-white px-6">
      <button
        type="button"
        aria-label="Notificações"
        className="relative rounded-lg p-2 text-ink-muted transition hover:bg-surface hover:text-ink"
      >
        <Bell className="size-5" />
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand ring-2 ring-white"
        />
      </button>

      <div className="h-6 w-px bg-line" />

      <Link
        href="/perfil"
        className="flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-surface"
        aria-label="Abrir meu perfil"
      >
        <Avatar name={user.name || user.email} image={user.image} />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">{user.name || user.email}</p>
          <p className="text-xs text-ink-muted">{papel || user.email}</p>
        </div>
      </Link>

      <LogoutButton />
    </header>
  );
}
