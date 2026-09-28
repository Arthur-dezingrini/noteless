"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Card } from "@/components/app/card";

const ABAS = [
  { href: "/configuracoes", label: "Clínica" },
  { href: "/configuracoes/usuarios", label: "Usuários" },
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
          const ativa = pathname === aba.href;
          return (
            <Link
              key={aba.href}
              href={aba.href}
              aria-current={ativa ? "page" : undefined}
              className={`block whitespace-nowrap rounded-field px-4 py-2 text-[15px] no-underline transition ${
                ativa ? "bg-surface font-semibold text-ink" : "text-ink-soft hover:bg-hover hover:text-ink"
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
