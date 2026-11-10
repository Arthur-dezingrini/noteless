"use client";

import { type DiaGalpao, type FichaLote } from "@vocare/shared";
import Link from "next/link";
import type { Route } from "next";
import { type KeyboardEvent } from "react";

import { Card, cx, EmptyState, tabela } from "@/components/ui";
import { dm, num, pct } from "./comum";

export function Diario({ ficha, editavel, onAbrir }: { ficha: FichaLote; editavel: boolean; onAbrir: (d: DiaGalpao) => void }) {
  if (ficha.diario.length === 0) {
    return <Card><EmptyState title="Nenhum apontamento ainda" description="Lance o primeiro dia para ver os indicadores." /></Card>;
  }
  const teclas = (e: KeyboardEvent, d: DiaGalpao) => {
    if (e.key === "Enter") onAbrir(d);
  };
  return (
    <Card className="overflow-x-auto">
      <table className={cx(tabela.table, "min-w-[720px]")}>
        <thead className={tabela.thead}>
          <tr>
            <th className={cx(tabela.th, "w-20")}>Data</th>
            <th className={tabela.th}>Galpão</th>
            <th className={tabela.th}>Mortas / elim.</th>
            <th className={tabela.th}>Ovos</th>
            <th className={tabela.th}>Postura</th>
            <th className={tabela.th}>Ração (kg)</th>
            <th className={tabela.th}>Origem</th>
          </tr>
        </thead>
        <tbody>
          {ficha.diario.map((d) => {
            const v = d.valores;
            const mortas = (v.mortasFemeas ?? 0) + (v.mortasMachos ?? 0);
            const elim = (v.eliminadasFemeas ?? 0) + (v.eliminadasMachos ?? 0);
            const props = editavel
              ? {
                  tabIndex: 0,
                  "aria-label": `Editar apontamento de ${dm(d.data)}, ${d.instalacaoNome}`,
                  onClick: () => onAbrir(d),
                  onKeyDown: (e: KeyboardEvent) => teclas(e, d),
                  className: tabela.linhaClicavel,
                }
              : { className: tabela.linha };
            return (
              <tr key={`${d.data}-${d.instalacaoId}`} {...props}>
                <td className={cx(tabela.td, "tabular-nums")}>{dm(d.data)}</td>
                <td className={cx(tabela.td, "truncate")}>{d.instalacaoNome}</td>
                <td className={cx(tabela.td, "tabular-nums")}>
                  {mortas} / {elim}
                  {d.indicadores.mortalidadeDiaPct != null && (
                    <span className="block text-sm text-ink-muted">{pct(d.indicadores.mortalidadeDiaPct)}</span>
                  )}
                </td>
                <td className={cx(tabela.td, "tabular-nums")}>{num(v.ovosTotal, 0)}</td>
                <td className={cx(tabela.td, "tabular-nums")}>{pct(d.indicadores.posturaPct)}</td>
                <td className={cx(tabela.td, "tabular-nums")}>{num(v.racaoKg)}</td>
                <td className={tabela.td}>
                  {d.ocorrenciaId ? (
                    <Link
                      href={`/notas?id=${encodeURIComponent(d.ocorrenciaId)}` as Route}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-ink underline underline-offset-[3px]"
                    >
                      da nota
                    </Link>
                  ) : (
                    <span className="text-ink-muted">manual</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
