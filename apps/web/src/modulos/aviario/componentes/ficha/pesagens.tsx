"use client";

import { ROTULO_SEXO, type FichaLote } from "@vocare/shared";

import { Card, cx, EmptyState, tabela } from "@/components/ui";
import { dm, num, pct } from "./comum";

export function Pesagens({ ficha }: { ficha: FichaLote }) {
  if (ficha.pesagens.length === 0) {
    return <Card><EmptyState title="Nenhuma pesagem" description="Registre a primeira pesagem em Pesagem." /></Card>;
  }
  return (
    <Card className="overflow-x-auto">
      <table className={cx(tabela.table, "min-w-[560px]")}>
        <thead className={tabela.thead}>
          <tr>
            <th className={cx(tabela.th, "w-20")}>Data</th>
            <th className={tabela.th}>Sexo</th>
            <th className={tabela.th}>Peso médio (g)</th>
            <th className={tabela.th}>Uniformidade</th>
            <th className={tabela.th}>Aves pesadas</th>
          </tr>
        </thead>
        <tbody>
          {ficha.pesagens.map((p) => (
            <tr key={p.id} className={cx(tabela.linha, "tabular-nums")}>
              <td className={tabela.td}>{dm(p.data)}</td>
              <td className={tabela.td}>{ROTULO_SEXO[p.sexo]}</td>
              <td className={tabela.td}>{num(p.pesoMedioG, 0)}</td>
              <td className={tabela.td}>{pct(p.uniformidadePct)}</td>
              <td className={tabela.td}>{num(p.amostra, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
