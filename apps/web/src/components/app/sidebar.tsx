"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/auth/logo";
import { NAV_ITEMS } from "@/lib/navigation";

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[17rem] shrink-0 flex-col border-r border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <Logo tone="dark" subtitle={orgName} />
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Principal">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-brand-soft font-medium text-brand"
                  : "text-ink-muted hover:bg-surface hover:text-ink"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="ml-auto size-1.5 rounded-full bg-brand"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* MOCK: plano/limite ainda não existe no produto. */}
      <div className="m-3 rounded-lg bg-brand-soft p-4">
        <p className="text-xs font-semibold text-brand">Plano Professional</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand/15">
          <div className="h-full w-[68%] rounded-full bg-brand" />
        </div>
        <p className="mt-2 text-xs text-brand/80">680 / 1.000 registros</p>
      </div>
    </aside>
  );
}
