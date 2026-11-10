"use client";

import { type FichaLote } from "@vocare/shared";

import { Card, cx, EmptyState, tabela } from "@/components/ui";
import { dm } from "./comum";

export function Vacinas({ ficha }: { ficha: FichaLote }) {
  if (ficha.vacinacoes.length === 0) {
    return <Card><EmptyState title="Nenhuma vacina" description="Registre a primeira vacinação em Vacina." /></Card>;
  }
  return (
    <Card className="overflow-x-auto">
      <table className={cx(tabela.table, "min-w-[520px]")}>
        <thead className={tabela.thead}>
          <tr>
            <th className={cx(tabela.th, "w-20")}>Data</th>
            <th className={tabela.th}>Vacina</th>
            <th className={tabela.th}>Via</th>
            <th className={tabela.th}>Próxima dose</th>
          </tr>
        </thead>
        <tbody>
          {ficha.vacinacoes.map((v) => (
            <tr key={v.id} className={cx(tabela.linha, "tabular-nums")}>
              <td className={tabela.td}>{dm(v.data)}</td>
              <td className={cx(tabela.td, "truncate")}>{v.vacina}</td>
              <td className={tabela.td}>{v.via ?? "—"}</td>
              <td className={tabela.td}>{v.proximaData ? dm(v.proximaData) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
