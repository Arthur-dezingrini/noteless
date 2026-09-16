"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card } from "@/components/app/card";
import { DIAS_SEMANA, formatar, mesAno } from "@/lib/datas";

type Props = {
  ano: number;
  mes: number; // 1–12
  hoje: string;
  selecionado: string;
  diasComConsulta: ReadonlySet<string>;
  onSelecionar: (iso: string) => void;
  onMesAnterior: () => void;
  onMesSeguinte: () => void;
};

function iso(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Grade mensal começando no domingo, com os dias vizinhos apagados. */
function celulas(ano: number, mes: number) {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const diasMesAnterior = new Date(Date.UTC(ano, mes - 1, 0)).getUTCDate();
  const offset = primeiro.getUTCDay();

  const out: { iso: string; dia: number; doMes: boolean }[] = [];
  for (let i = offset - 1; i >= 0; i--) {
    const d = diasMesAnterior - i;
    const m = mes === 1 ? 12 : mes - 1;
    const a = mes === 1 ? ano - 1 : ano;
    out.push({ iso: iso(a, m, d), dia: d, doMes: false });
  }
  for (let d = 1; d <= diasNoMes; d++) out.push({ iso: iso(ano, mes, d), dia: d, doMes: true });
  while (out.length % 7 !== 0) {
    const d = out.length - offset - diasNoMes + 1;
    const m = mes === 12 ? 1 : mes + 1;
    const a = mes === 12 ? ano + 1 : ano;
    out.push({ iso: iso(a, m, d), dia: d, doMes: false });
  }
  return out;
}

export function Calendario({
  ano,
  mes,
  hoje,
  selecionado,
  diasComConsulta,
  onSelecionar,
  onMesAnterior,
  onMesSeguinte,
}: Props) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">{mesAno(ano, mes)}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onMesAnterior}
            aria-label="Mês anterior"
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface hover:text-ink"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMesSeguinte}
            aria-label="Mês seguinte"
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface hover:text-ink"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={mesAno(ano, mes)} className="mt-4">
        <div role="row" className="grid grid-cols-7 text-center text-xs text-ink-muted">
          {DIAS_SEMANA.map((d) => (
            <div key={d} role="columnheader" className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {celulas(ano, mes).map((c) => {
            const ehHoje = c.iso === hoje;
            const ativo = c.iso === selecionado;
            const tem = diasComConsulta.has(c.iso);
            return (
              <button
                key={c.iso}
                type="button"
                role="gridcell"
                aria-selected={ativo}
                aria-label={
                  formatar(c.iso, { day: "numeric", month: "long" }) + (tem ? ", com consultas" : "")
                }
                onClick={() => onSelecionar(c.iso)}
                className={`mx-auto flex h-8 w-full max-w-[6.5rem] items-center justify-center rounded-lg text-sm transition ${
                  ativo
                    ? "bg-brand font-semibold text-white"
                    : tem
                      ? "bg-brand-soft font-semibold text-brand hover:bg-brand/20"
                      : c.doMes
                        ? "text-ink hover:bg-surface"
                        : "text-ink-muted/50 hover:bg-surface"
                } ${ehHoje && !ativo ? "ring-1 ring-brand ring-inset" : ""}`}
              >
                {c.dia}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
