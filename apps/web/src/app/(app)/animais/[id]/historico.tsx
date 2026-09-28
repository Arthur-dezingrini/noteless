"use client";

import { ROTULO_TIPO_EVENTO, TIPOS_EVENTO, type Evento, type TipoEvento } from "@vocare/shared";
import { Mic } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/app/card";
import { dataExtenso } from "@/lib/datas";

/** Histórico unificado, agrupado por dia, com filtro por tipo. */
export function Historico({ eventos }: { eventos: Evento[] }) {
  const [filtro, setFiltro] = useState<TipoEvento | null>(null);
  const presentes = TIPOS_EVENTO.filter((t) => eventos.some((e) => e.tipo === t));
  const visiveis = filtro ? eventos.filter((e) => e.tipo === filtro) : eventos;

  const porDia = new Map<string, Evento[]>();
  for (const e of visiveis) porDia.set(e.data, [...(porDia.get(e.data) ?? []), e]);

  const chip = (ativo: boolean) =>
    `h-9 cursor-pointer rounded-full px-3.5 text-sm font-semibold transition ${
      ativo ? "bg-ink text-white" : "border border-button-border bg-white text-ink-soft hover:bg-hover"
    }`;

  return (
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-5 pb-2">
        <h2 className="text-lg font-semibold text-ink">Histórico</h2>
        {presentes.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar histórico">
            <button type="button" aria-pressed={filtro === null} onClick={() => setFiltro(null)} className={chip(filtro === null)}>
              Tudo
            </button>
            {presentes.map((t) => (
              <button key={t} type="button" aria-pressed={filtro === t} onClick={() => setFiltro(t)} className={chip(filtro === t)}>
                {ROTULO_TIPO_EVENTO[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {visiveis.length === 0 ? (
        <p className="px-5 pt-2 pb-6 text-[15px] text-ink-muted">Nada registrado ainda. O que for salvo das ocorrências aparece aqui.</p>
      ) : (
        <ol className="flex flex-col px-5 pb-3">
          {[...porDia.entries()].map(([dia, lista]) => (
            <li key={dia} className="border-t border-line-soft py-3.5 first:border-t-0">
              <p className="mb-2 text-sm font-semibold text-ink-muted">{dataExtenso(dia)}</p>
              <ul className="flex flex-col gap-2.5">
                {lista.map((e) => (
                  <li key={e.id} className="flex flex-col">
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                      {e.titulo}
                      {e.ocorrenciaId && (
                        <span title="Veio de um áudio" className="inline-flex items-center gap-1 text-[13px] font-normal text-ink-muted">
                          <Mic className="size-3.5" aria-hidden="true" /> áudio
                        </span>
                      )}
                    </span>
                    {e.detalhe && <span className="text-[15px] text-ink-soft">{e.detalhe}</span>}
                    {e.por && <span className="text-[13px] text-ink-muted">por {e.por}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
