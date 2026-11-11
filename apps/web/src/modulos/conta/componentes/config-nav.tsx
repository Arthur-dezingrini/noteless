"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/ui";

const ABAS: { href: Route; label: string; de: "admin" | "super" | "ambos" }[] = [
  { href: "/configuracoes", label: "Conta", de: "admin" },
  { href: "/configuracoes/usuarios", label: "Usuários", de: "admin" },
  { href: "/configuracoes/vinculos", label: "Vínculos", de: "super" },
  { href: "/configuracoes/gravadores", label: "Gravadores", de: "ambos" },
];

/** Conta e Usuários são do administrador da empresa; Vínculos, do super usuário; Gravadores, dos dois. */
export function ConfigNav({ admin, ehSuper }: { admin: boolean; ehSuper: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções de configuração" className="flex gap-6 border-b border-line">
      {ABAS.filter((aba) => (aba.de === "ambos" ? admin || ehSuper : aba.de === "admin" ? admin : ehSuper)).map((aba) => {
        const ativa = pathname === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 pb-[11px] text-[15px] no-underline",
              ativa ? "border-ink font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
