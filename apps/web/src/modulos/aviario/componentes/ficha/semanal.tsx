"use client";

import { type FichaLote } from "@vocare/shared";

import { Card, cx, EmptyState, tabela } from "@/components/ui";
import { dm, num } from "./comum";

export function Semanal({ ficha }: { ficha: FichaLote }) {
  if (ficha.semanal.length === 0) {
    return <Card><EmptyState title="Nenhuma semana ainda" description="O resumo semanal aparece depois do primeiro apontamento." /></Card>;
  }
  const cab = ["Sem.", "Período", "Mortas", "Elim.", "Mort. %", "Postura %", "Incub. %", "Ração g/ave", "Peso F (g)", "Peso M (g)", "Unif. F %", "Unif. M %"];
  return (
    <Card className="overflow-x-auto print:border-0">
      <h2 className="hidden px-[18px] pt-4 text-lg font-semibold text-ink print:block">Lote {ficha.lote.codigo}, resumo semanal</h2>
      <table className={cx(tabela.table, "min-w-[900px]")}>
        <thead className={tabela.thead}>
          <tr>
            {cab.map((c) => (
              <th key={c} className={tabela.th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ficha.semanal.map((s) => (
            <tr key={s.semana} className={cx(tabela.linha, "tabular-nums")}>
              <td className={tabela.td}>{s.semana}ª</td>
              <td className={tabela.td}>
                {dm(s.inicio)} a {dm(s.fim)}
              </td>
              <td className={tabela.td}>{s.mortas}</td>
              <td className={tabela.td}>{s.eliminadas}</td>
              <td className={tabela.td}>{num(s.mortalidadePct)}</td>
              <td className={tabela.td}>{num(s.posturaPct)}</td>
              <td className={tabela.td}>{num(s.incubaveisPct)}</td>
              <td className={tabela.td}>{num(s.racaoGAveDia)}</td>
              <td className={tabela.td}>{num(s.pesoFemeaG, 0)}</td>
              <td className={tabela.td}>{num(s.pesoMachoG, 0)}</td>
              <td className={tabela.td}>{num(s.uniformidadeFemeaPct)}</td>
              <td className={tabela.td}>{num(s.uniformidadeMachoPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-[18px] py-3 text-sm text-ink-muted print:hidden">Use Imprimir do navegador para guardar ou mandar este resumo.</p>
    </Card>
  );
}
