"use client";

import { ROTULO_FASE_LOTE, type Instalacao, type LoteResumo } from "@vocare/shared";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition, type KeyboardEvent } from "react";

import { Button, Card, cx, EmptyState, PageHeader, StatusText, Tabs, tabela } from "@/components/ui";

import { AlojarModal } from "./alojar-modal";

type Situacao = "ativo" | "encerrado";

const ABAS = [
  { value: "ativo", label: "Ativos" },
  { value: "encerrado", label: "Encerrados" },
] as const;

function pct(v: number | null) {
  return v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

type Props = {
  orgId: string;
  situacao: Situacao;
  lotes: LoteResumo[];
  instalacoes: Instalacao[];
  possoGerenciar: boolean;
};

export function LotesLista({ orgId, situacao, lotes, instalacoes, possoGerenciar }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const [alojando, setAlojando] = useState(false);

  function trocarAba(s: Situacao) {
    start(() => router.push(`/lotes?situacao=${s}` as Route, { scroll: false }));
  }

  function abrir(l: LoteResumo) {
    router.push(`/lotes/${l.id}`);
  }

  function teclas(e: KeyboardEvent, l: LoteResumo) {
    if (e.key === "Enter") abrir(l);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lotes"
        description="Clique em um lote para ver os apontamentos."
        actions={possoGerenciar ? <Button onClick={() => setAlojando(true)}>Alojar lote</Button> : undefined}
      />

      <Tabs items={ABAS} value={situacao} onChange={trocarAba} label="Situação do lote" />

      <Card className="overflow-hidden">
        <table className={tabela.table}>
          <thead className={tabela.thead}>
            <tr>
              <th className={tabela.th}>Lote</th>
              <th className={cx(tabela.th, "hidden md:table-cell")}>Galpões</th>
              <th className={cx(tabela.th, "w-24")}>Semana</th>
              <th className={cx(tabela.th, "hidden w-32 md:table-cell")}>Vivas (F/M)</th>
              <th className={cx(tabela.th, "hidden w-28 xl:table-cell")}>Postura ontem</th>
              <th className={cx(tabela.th, "hidden w-32 xl:table-cell")}>Mortalidade sem.</th>
              <th className={tabela.th}>Alertas</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr
                key={l.id}
                role="link"
                tabIndex={0}
                aria-label={`Abrir lote ${l.codigo}`}
                onClick={() => abrir(l)}
                onKeyDown={(e) => teclas(e, l)}
                className={tabela.linhaClicavel}
              >
                <td className={tabela.td}>
                  <span className="block truncate font-semibold text-ink">{l.codigo}</span>
                  <span className="block truncate text-sm text-ink-muted">
                    {[l.linhagem, ROTULO_FASE_LOTE[l.fase]].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className={cx(tabela.td, "hidden truncate text-ink-soft md:table-cell")}>
                  {l.galpoes.map((g) => g.nome).join(", ") || "—"}
                </td>
                <td className={cx(tabela.td, "tabular-nums")}>{l.semana}ª</td>
                <td className={cx(tabela.td, "hidden text-ink tabular-nums md:table-cell")}>
                  {l.vivas.femeas.toLocaleString("pt-BR")} / {l.vivas.machos.toLocaleString("pt-BR")}
                </td>
                <td className={cx(tabela.td, "hidden text-ink tabular-nums xl:table-cell")}>{pct(l.posturaOntemPct)}</td>
                <td className={cx(tabela.td, "hidden text-ink tabular-nums xl:table-cell")}>{pct(l.mortalidadeSemanaPct)}</td>
                <td className={tabela.td}>
                  <span className="flex flex-col gap-0.5">
                    {l.semApontamentoHoje && <StatusText tone="aviso">Sem apontamento hoje</StatusText>}
                    {l.mortalidadeAltaHoje && <StatusText tone="perigo">Mortalidade alta hoje</StatusText>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lotes.length === 0 && (
          <EmptyState
            title={situacao === "ativo" ? "Nenhum lote ativo" : "Nenhum lote encerrado"}
            description={situacao === "ativo" ? "Aloje um lote em um galpão livre para começar os apontamentos." : "Lotes encerrados aparecem aqui."}
          />
        )}
      </Card>

      {alojando && (
        <AlojarModal
          orgId={orgId}
          instalacoes={instalacoes}
          onClose={() => setAlojando(false)}
          onDone={() => {
            setAlojando(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
