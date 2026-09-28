"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const titulo = mesAno(ano, mes).replace(" ", " de ");
  return (
    <div className="flex w-[268px] shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onMesAnterior} aria-label="Mês anterior" className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-surface">
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="text-[15px] font-semibold text-ink">{titulo}</h2>
        <button type="button" onClick={onMesSeguinte} aria-label="Próximo mês" className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft hover:bg-surface">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div role="grid" aria-label={titulo} className="grid grid-cols-7 gap-0.5 text-center">
        {DIAS_SEMANA.map((d) => (
          <span key={d} role="columnheader" aria-label={d} className="py-1 text-[13px] text-ink-muted">
            {d.charAt(0)}
          </span>
        ))}
        {celulas(ano, mes).map((c) => {
          if (!c.doMes) return <span key={c.iso} aria-hidden="true" />;
          const ativo = c.iso === selecionado;
          const tem = diasComConsulta.has(c.iso);
          return (
            <button
              key={c.iso}
              type="button"
              role="gridcell"
              aria-selected={ativo}
              aria-label={formatar(c.iso, { day: "numeric", month: "long" }) + (tem ? ", com consultas" : "") + (c.iso === hoje ? ", hoje" : "")}
              onClick={() => onSelecionar(c.iso)}
              className={`flex h-9 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular-nums transition ${
                ativo ? "bg-ink text-white" : c.iso === hoje ? "font-semibold text-brand-ink hover:bg-surface" : "text-ink hover:bg-surface"
              }`}
            >
              {c.dia}
              <span aria-hidden="true" className={`size-1 rounded-full ${tem ? (ativo ? "bg-white" : "bg-[#9a9f9b]") : ""}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
