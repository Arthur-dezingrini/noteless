"use client";

import type { Organization } from "@vocare/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/auth/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { NAV_ITEMS, NAV_RODAPE } from "@/lib/navigation";

import { initials } from "./avatar";
import { OrgSwitcher } from "./org-switcher";

export function Sidebar({
  organizacoes,
  ativaId,
  animais,
  user,
  subtitulo,
  pendentes,
  admin,
}: {
  organizacoes: Organization[];
  ativaId: string | null;
  animais: number | null;
  user: { name: string; email: string };
  /** Cargo ("Veterinário") ou, sem cargo, o papel. */
  subtitulo: string;
  /** Ocorrências esperando conferência — aparece ao lado do item. */
  pendentes: number;
  /** Configurações é só de administrador. */
  admin: boolean;
}) {
  const pathname = usePathname();

  const item = (href: string, label: string, count?: number) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center justify-between rounded-lg px-2.5 py-[9px] text-[15px] text-ink no-underline transition ${
          active ? "bg-surface font-semibold" : "hover:bg-hover"
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

  const nome = user.name || user.email;

  return (
    <aside className="print:hidden sticky top-0 flex h-svh w-56 shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-line px-3.5 py-[22px]">
      <Logo className="px-2" />
      <OrgSwitcher organizacoes={organizacoes} ativaId={ativaId} animais={animais} />

      <nav className="flex flex-col gap-0.5" aria-label="Principal">
        {NAV_ITEMS.map((n) => item(n.href, n.label, n.href === "/ocorrencias" ? pendentes : undefined))}
      </nav>

      <div className="mt-auto flex flex-col gap-1.5">
        {admin && NAV_RODAPE.map((n) => item(n.href, n.label))}
        <div className="flex items-center gap-2.5 border-t border-line px-2 pt-3.5">
          <Link href="/perfil" className="flex min-w-0 flex-1 items-center gap-2.5 text-ink no-underline">
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9e5dc] text-[13px] font-semibold">
              {initials(nome)}
            </span>
            <span className="flex min-w-0 flex-col text-sm leading-tight">
              <span className="truncate font-semibold">{nome}</span>
              <span className="truncate text-ink-muted">{subtitulo}</span>
            </span>
          </Link>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
