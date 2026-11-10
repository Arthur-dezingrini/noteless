"use client";

import type { Organization } from "@vocare/shared";
import { ChevronDown } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/auth/logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { cx } from "@/components/ui";
import { acharAtivo, MENU, menuVisivel, RODAPE, type ModuloMenu } from "@/lib/navigation";

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
  temInstalacao,
}: {
  organizacoes: Organization[];
  ativaId: string | null;
  animais: number | null;
  user: { name: string; email: string };
  /** Cargo ("Veterinário") ou, sem cargo, o papel. */
  subtitulo: string;
  /** Notas esperando conferência — aparece ao lado do item. */
  pendentes: number;
  /** Configurações é só de administrador. */
  admin: boolean;
  /** Organização com galpão/instalação cadastrada: libera as telas `soComInstalacao`. */
  temInstalacao: boolean;
}) {
  const pathname = usePathname();
  const ativo = acharAtivo(pathname, useSearchParams().get("tela"));
  // Aberto/fechado escolhido no clique; sem escolha, abre só o módulo da tela atual.
  const [escolha, setEscolha] = useState<Record<string, boolean>>({});
  const aberto = (id: string) => escolha[id] ?? id === ativo?.modulo.id;

  const item = (id: string, href: Route, label: string, o: { count?: number; emBreve?: boolean; recuo?: boolean } = {}) => {
    const active = ativo?.tela ? ativo.tela.id === id : ativo?.modulo.id === id;
    return (
      <Link
        key={id}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex items-center justify-between gap-2 rounded-lg py-[9px] text-[15px] no-underline transition",
          o.recuo ? "pr-2.5 pl-7" : "px-2.5",
          o.emBreve ? "text-ink-muted" : "text-ink",
          active ? "bg-surface font-semibold" : "hover:bg-hover",
        )}
      >
        {label}
        {o.emBreve ? <span className="text-[12px] text-ink-muted">em breve</span> : null}
        {o.count ? (
          <span className="font-medium text-ink-muted tabular-nums" aria-label={`${o.count} para conferir`}>
            {o.count}
          </span>
        ) : null}
      </Link>
    );
  };

  const modulo = (m: ModuloMenu) => {
    if (m.telas.length === 0) {
      return item(m.id, m.href!, m.rotulo, { emBreve: m.emBreve, count: m.id === "notas" ? pendentes : undefined });
    }
    const painel = `menu-${m.id}`;
    const abre = aberto(m.id);
    return (
      <div key={m.id} className="flex flex-col gap-0.5">
        <button
          type="button"
          aria-expanded={abre}
          aria-controls={painel}
          onClick={() => setEscolha((e) => ({ ...e, [m.id]: !abre }))}
          className={cx(
            "flex items-center justify-between rounded-lg px-2.5 py-[9px] text-left text-[15px] text-ink transition hover:bg-hover",
            ativo?.modulo.id === m.id && "font-semibold",
          )}
        >
          {m.rotulo}
          <ChevronDown aria-hidden="true" className={cx("size-4 text-ink-muted transition", abre && "rotate-180")} />
        </button>
        <div id={painel} hidden={!abre} className="flex flex-col gap-0.5">
          {m.telas.map((t) => item(t.id, t.href, t.rotulo, { emBreve: t.emBreve, recuo: true }))}
        </div>
      </div>
    );
  };

  const nome = user.name || user.email;

  return (
    <aside className="print:hidden sticky top-0 flex h-svh w-56 shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-line px-3.5 py-[22px]">
      <Logo className="px-2" />
      <OrgSwitcher organizacoes={organizacoes} ativaId={ativaId} animais={animais} />

      <nav className="flex flex-col gap-0.5" aria-label="Principal">
        {menuVisivel(MENU, { temInstalacao }).map(modulo)}
      </nav>

      <div className="mt-auto flex flex-col gap-1.5">
        {admin && RODAPE.map(modulo)}
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
