"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Card } from "@/components/app/card";

const ABAS = [
  { href: "/configuracoes", label: "Clínica" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
  { label: "Veterinários", disabled: true },
  { label: "Notificações", disabled: true },
  { label: "Segurança", disabled: true },
];

export function ConfigNav() {
  const pathname = usePathname();

  return (
    <Card className="w-full p-1">
      <nav
        aria-label="Seções de configuração"
        className="flex min-w-max gap-1 overflow-x-auto"
      >
        {ABAS.map((aba) => {
          const ativa = aba.href !== undefined && pathname === aba.href;
          if (aba.disabled) {
            return (
              <span
                key={aba.label}
                aria-disabled="true"
                className="block cursor-not-allowed whitespace-nowrap rounded-lg px-4 py-2.5 text-sm text-ink-muted/60"
              >
                {aba.label}
              </span>
            );
          }

          return (
            <Link
              key={aba.href}
              href={aba.href!}
              aria-current={ativa ? "page" : undefined}
              className={`block whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition ${
                ativa
                  ? "bg-brand-soft font-medium text-brand"
                  : "text-ink-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {aba.label}
            </Link>
          );
        })}
      </nav>
    </Card>
  );
}
