"use client";

import { Info, MoreHorizontal, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/app/avatar";
import { Badge } from "@/components/app/badge";
import { Card, CardHeader } from "@/components/app/card";
import { Modal } from "@/components/app/modal";
import { PageHeader } from "@/components/app/page-header";
import { adicionarDias, dataExtenso, formatar, inicioDaSemana } from "@/lib/datas";
import { STATUS_CONSULTA, type Consulta } from "@/lib/mock/agenda";

import { Calendario } from "./calendario";

type Modo = "dia" | "semana";

const inputClasses =
  "w-full rounded-lg border border-field-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AgendaView({ hoje, consultas }: { hoje: string; consultas: Consulta[] }) {
  const [selecionado, setSelecionado] = useState(hoje);
  const [modo, setModo] = useState<Modo>("dia");
  const [novaAberta, setNovaAberta] = useState(false);
  const [{ ano, mes }, setMesVisivel] = useState(() => ({
    ano: Number(hoje.slice(0, 4)),
    mes: Number(hoje.slice(5, 7)),
  }));

  const diasComConsulta = useMemo(() => new Set(consultas.map((c) => c.data)), [consultas]);

  function mudarMes(delta: number) {
    setMesVisivel(({ ano, mes }) => {
      const m = mes + delta;
      if (m < 1) return { ano: ano - 1, mes: 12 };
      if (m > 12) return { ano: ano + 1, mes: 1 };
      return { ano, mes: m };
    });
  }

  function selecionar(iso: string) {
    setSelecionado(iso);
    // Clicar num dia de outro mês (apagado) leva o calendário até ele.
    setMesVisivel({ ano: Number(iso.slice(0, 4)), mes: Number(iso.slice(5, 7)) });
  }

  const dias =
    modo === "dia"
      ? [selecionado]
      : Array.from({ length: 7 }, (_, i) => adicionarDias(inicioDaSemana(selecionado), i));

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={dataExtenso(selecionado)}
        aside={
          <div className="flex items-center gap-3">
            <div
              role="radiogroup"
              aria-label="Modo de visualização"
              className="flex rounded-lg bg-surface p-1"
            >
              {(["dia", "semana"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={modo === m}
                  onClick={() => setModo(m)}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                    modo === m ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {m === "dia" ? "Dia" : "Semana"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNovaAberta(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              <Plus className="size-4" /> Nova consulta
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        <Calendario
          ano={ano}
          mes={mes}
          hoje={hoje}
          selecionado={selecionado}
          diasComConsulta={diasComConsulta}
          onSelecionar={selecionar}
          onMesAnterior={() => mudarMes(-1)}
          onMesSeguinte={() => mudarMes(1)}
        />

        {dias.map((dia) => {
          const doDia = consultas.filter((c) => c.data === dia);
          const rotulo =
            dia === hoje
              ? "Hoje"
              : modo === "semana"
                ? formatar(dia, { weekday: "long", day: "numeric" })
                : formatar(dia, { day: "numeric", month: "long" });
          return (
            <Card key={dia}>
              <CardHeader
                title={`Consultas · ${capitalizar(rotulo)}`}
                aside={
                  doDia.length > 0 && (
                    <Badge tone="gray">{`${doDia.length} agendada${doDia.length > 1 ? "s" : ""}`}</Badge>
                  )
                }
              />
              {doDia.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-ink-muted">Nenhuma consulta neste dia.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {doDia.map((c) => (
                    <LinhaConsulta key={c.id} c={c} />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <NovaConsultaModal
        open={novaAberta}
        onClose={() => setNovaAberta(false)}
        dataInicial={selecionado}
      />
    </>
  );
}

function LinhaConsulta({ c }: { c: Consulta }) {
  const st = STATUS_CONSULTA[c.status];
  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <span className="w-12 text-sm text-ink-muted tabular-nums">{c.hora}</span>
      <span aria-hidden="true" className={`h-8 w-0.5 shrink-0 rounded-full ${st.barra}`} />
      <Avatar name={c.animal} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {c.animal} <span className="text-xs font-normal text-ink-muted">· {c.especie}</span>
        </p>
        <p className="truncate text-xs text-ink-muted">
          {c.tipo} · {c.tutor}
        </p>
      </div>
      <span className="hidden text-xs text-ink-muted md:block">{c.veterinario}</span>
      <span className="hidden text-xs text-ink-muted tabular-nums sm:block">{c.duracaoMin} min</span>
      <Badge tone={st.tone}>{st.label}</Badge>
      <button
        type="button"
        aria-label="Mais ações"
        className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface hover:text-ink"
      >
        <MoreHorizontal className="size-4" />
      </button>
    </li>
  );
}

function NovaConsultaModal({
  open,
  onClose,
  dataInicial,
}: {
  open: boolean;
  onClose: () => void;
  dataInicial: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Nova consulta">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-900">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>A agenda ainda usa dados de exemplo. Salvar entra junto com o cadastro de consultas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink">Animal</span>
            <input className={inputClasses} placeholder="Nome ou brinco" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Data</span>
            <input type="date" className={inputClasses} defaultValue={dataInicial} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Hora</span>
            <input type="time" className={inputClasses} defaultValue="09:00" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Tipo</span>
            <select className={inputClasses} defaultValue="consulta">
              <option value="consulta">Consulta clínica</option>
              <option value="vacinacao">Vacinação</option>
              <option value="retorno">Retorno</option>
              <option value="cirurgia">Cirurgia</option>
              <option value="checkup">Check-up</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Duração</span>
            <select className={inputClasses} defaultValue="30">
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </select>
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink">Veterinário</span>
            <input className={inputClasses} placeholder="Quem atende" />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-ink">Observações</span>
            <textarea rows={2} className={inputClasses} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled
            title="Disponível quando existir cadastro de consultas"
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
