"use client";

import type { Organization } from "@vocare/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/auth/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { NAV_ITEMS, NAV_RODAPE } from "@/lib/navigation";

import { Avatar } from "./avatar";
import { OrgSwitcher } from "./org-switcher";

export function Sidebar({
  organizacoes,
  ativaId,
  user,
  papel,
  pendentes,
}: {
  organizacoes: Organization[];
  ativaId: string | null;
  user: { name: string; email: string; image?: string | null };
  papel: string;
  /** Ocorrências esperando conferência — aparece ao lado do item. */
  pendentes: number;
}) {
  const pathname = usePathname();

  const item = (href: string, label: string, count?: number) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[15px] no-underline transition ${
          active ? "bg-surface font-semibold text-ink" : "text-ink-soft hover:bg-hover"
        }`}
      >
        {label}
        {count ? (
          <span className="font-medium text-ink-muted tabular-nums" aria-label={`${count} para conferir`}>
            {count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line px-3.5 py-6">
      <Logo tone="dark" className="px-2" />
      <OrgSwitcher organizacoes={organizacoes} ativaId={ativaId} />

      <nav className="flex flex-col gap-0.5" aria-label="Principal">
        {NAV_ITEMS.map((n) => item(n.href, n.label, n.href === "/ocorrencias" ? pendentes : undefined))}
      </nav>

      <div className="mt-auto flex flex-col gap-1.5">
        {NAV_RODAPE.map((n) => item(n.href, n.label))}
        <div className="flex items-center gap-2 border-t border-line px-2 pt-3.5">
          <Link href="/perfil" className="flex min-w-0 flex-1 items-center gap-2.5 text-ink no-underline">
            <Avatar name={user.name || user.email} image={user.image} />
            <span className="min-w-0 text-sm leading-tight">
              <span className="block truncate font-semibold">{user.name || user.email}</span>
              <span className="block truncate text-ink-muted">{papel}</span>
            </span>
          </Link>
          <LogoutButton compacto />
        </div>
      </div>
    </aside>
  );
}
