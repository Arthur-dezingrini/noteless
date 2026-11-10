"use client";

import { ROTULO_STATUS_CONSULTA, ROTULO_TIPO_CONSULTA, type Consulta } from "@vocare/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type DragEvent } from "react";

import { buttonClass, cx, StatusText } from "@/components/ui";
import { adicionarDias, formatar, paraDate } from "@/lib/datas";
import { duracao, nomeAlvo, TOM_STATUS } from "./util";

export function Semana({
  consultas,
  hoje,
  inicio,
  onMudarSemana,
  onMover,
}: {
  consultas: Consulta[];
  hoje: string;
  /** Domingo da semana. */
  inicio: string;
  onMudarSemana: (dias: number) => void;
  onMover: (c: Consulta, data: string) => void;
}) {
  const [alvo, setAlvo] = useState<string | null>(null);
  const todos = Array.from({ length: 7 }, (_, i) => adicionarDias(inicio, i));
  const temAlgo = (d: string) => consultas.some((c) => c.data === d);
  // Segunda a sexta sempre; fim de semana só se tiver consulta.
  const dias = todos.filter((d, i) => (i >= 1 && i <= 5) || temAlgo(d));
  const primeiro = dias[0]!;
  const ultimo = dias.at(-1)!;
  const titulo =
    primeiro.slice(5, 7) === ultimo.slice(5, 7)
      ? `${Number(primeiro.slice(8))} a ${formatar(ultimo, { day: "numeric", month: "long" })}`
      : `${formatar(primeiro, { day: "numeric", month: "short" })} a ${formatar(ultimo, { day: "numeric", month: "short" })}`;

  function soltar(e: DragEvent, data: string) {
    e.preventDefault();
    setAlvo(null);
    const id = e.dataTransfer.getData("text/plain");
    const c = consultas.find((x) => x.id === id);
    if (c) onMover(c, data);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMudarSemana(-7)}
            aria-label="Semana anterior"
            className={buttonClass("iconePequeno")}
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
          <button
            type="button"
            onClick={() => onMudarSemana(7)}
            aria-label="Próxima semana"
            className={buttonClass("iconePequeno")}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <p className="text-sm text-ink-muted">Arraste um horário para outro dia para remarcar.</p>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[40rem] gap-3"
          style={{
            gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))`,
          }}
        >
          {dias.map((d) => {
            const itens = consultas.filter((c) => c.data === d).sort((a, b) => a.hora.localeCompare(b.hora));
            const semana = formatar(d, { weekday: "short" }).replace(".", "");
            return (
              <div
                key={d}
                onDragOver={(e) => {
                  e.preventDefault();
                  setAlvo(d);
                }}
                onDragLeave={() => setAlvo((a) => (a === d ? null : a))}
                onDrop={(e) => soltar(e, d)}
                className={cx("flex min-h-[26rem] min-w-0 flex-col gap-2 rounded-xl p-1 transition", alvo === d && "bg-brand-soft")}
              >
                <div className={cx("flex items-baseline gap-1.5 border-b-2 px-1.5 pb-2", d === hoje ? "border-ink" : "border-line")}>
                  <span className="text-sm text-ink-muted capitalize">{semana}</span>
                  <span className="text-lg font-semibold text-ink">{paraDate(d).getUTCDate()}</span>
                </div>
                {itens.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                    className="flex cursor-grab flex-col gap-0.5 rounded-field border border-line bg-white px-3 py-2.5 active:cursor-grabbing"
                  >
                    <span className="text-[13px] text-ink-muted tabular-nums">
                      {c.hora} · {duracao(c.duracaoMin)}
                    </span>
                    <span className="truncate text-sm font-semibold text-ink">{nomeAlvo(c)}</span>
                    <span className="truncate text-[13px] text-ink-soft">{c.observacoes || ROTULO_TIPO_CONSULTA[c.tipo]}</span>
                    <StatusText tone={TOM_STATUS[c.status]} className="text-[13px]">
                      {ROTULO_STATUS_CONSULTA[c.status]}
                    </StatusText>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
