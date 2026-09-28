"use client";

import {
  atualizarConsultaSchema,
  criarConsultaSchema,
  ROTULO_ESPECIE,
  ROTULO_STATUS_CONSULTA,
  ROTULO_TIPO_CONSULTA,
  STATUS_CONSULTA,
  TIPOS_CONSULTA,
  type Animal,
  type Consulta,
  type StatusConsulta,
} from "@vocare/shared";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { Avatar } from "@/components/app/avatar";
import { Badge, type Tone } from "@/components/app/badge";
import { Card, CardHeader } from "@/components/app/card";
import { Modal } from "@/components/app/modal";
import { PageHeader } from "@/components/app/page-header";
import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { chamarApi } from "@/lib/api-client";
import { adicionarDias, dataExtenso, formatar, inicioDaSemana } from "@/lib/datas";

import { Calendario } from "./calendario";

type Modo = "dia" | "semana";
type Veterinario = { id: string; nome: string };
type Dialogo =
  | { tipo: "nova" }
  | { tipo: "editar"; consulta: Consulta }
  | { tipo: "excluir"; consulta: Consulta }
  | null;

const ESTILO_STATUS: Record<StatusConsulta, { tone: Tone; barra: string }> = {
  agendada: { tone: "yellow", barra: "bg-amber-400" },
  confirmada: { tone: "green", barra: "bg-brand" },
  urgente: { tone: "red", barra: "bg-red-500" },
  concluida: { tone: "gray", barra: "bg-line" },
  cancelada: { tone: "gray", barra: "bg-line" },
};

const inputClasses = campo;

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Props = {
  orgId: string;
  hoje: string;
  consultas: Consulta[];
  animais: Animal[];
  veterinarios: Veterinario[];
};

export function AgendaView({ orgId, hoje, consultas, animais, veterinarios }: Props) {
  const router = useRouter();
  const [selecionado, setSelecionado] = useState(hoje);
  const [modo, setModo] = useState<Modo>("dia");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [{ ano, mes }, setMesVisivel] = useState(() => ({
    ano: Number(hoje.slice(0, 4)),
    mes: Number(hoje.slice(5, 7)),
  }));

  const diasComConsulta = useMemo(
    () => new Set(consultas.filter((c) => c.status !== "cancelada").map((c) => c.data)),
    [consultas],
  );

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

  function concluido() {
    setDialogo(null);
    router.refresh();
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
              onClick={() => setDialogo({ tipo: "nova" })}
              className={btn.primario}
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
                    <LinhaConsulta
                      key={c.id}
                      c={c}
                      onEditar={() => setDialogo({ tipo: "editar", consulta: c })}
                      onExcluir={() => setDialogo({ tipo: "excluir", consulta: c })}
                    />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <ConsultaModal
        key={dialogo?.tipo === "editar" ? dialogo.consulta.id : dialogo?.tipo ?? "fechado"}
        open={dialogo?.tipo === "nova" || dialogo?.tipo === "editar"}
        consulta={dialogo?.tipo === "editar" ? dialogo.consulta : null}
        dataInicial={selecionado}
        orgId={orgId}
        animais={animais}
        veterinarios={veterinarios}
        onClose={() => setDialogo(null)}
        onDone={concluido}
      />

      <ExcluirModal
        consulta={dialogo?.tipo === "excluir" ? dialogo.consulta : null}
        orgId={orgId}
        onClose={() => setDialogo(null)}
        onDone={concluido}
      />
    </>
  );
}

function LinhaConsulta({
  c,
  onEditar,
  onExcluir,
}: {
  c: Consulta;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const st = ESTILO_STATUS[c.status];
  const cancelada = c.status === "cancelada";
  return (
    <li className={`flex items-center gap-4 px-5 py-3.5 ${cancelada ? "opacity-60" : ""}`}>
      <span className="w-12 text-sm text-ink-muted tabular-nums">{c.hora}</span>
      <span aria-hidden="true" className={`h-8 w-0.5 shrink-0 rounded-full ${st.barra}`} />
      <Avatar name={c.animalNome} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-ink ${cancelada ? "line-through" : ""}`}>
          {c.animalNome}{" "}
          <span className="text-xs font-normal text-ink-muted">· {ROTULO_ESPECIE[c.animalEspecie]}</span>
        </p>
        <p className="truncate text-xs text-ink-muted">
          {[ROTULO_TIPO_CONSULTA[c.tipo], c.animalTutor].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="hidden text-xs text-ink-muted md:block">{c.veterinarioNome ?? "—"}</span>
      <span className="hidden text-xs text-ink-muted tabular-nums sm:block">{c.duracaoMin} min</span>
      <Badge tone={st.tone}>{ROTULO_STATUS_CONSULTA[c.status]}</Badge>
      <MenuAcoes onEditar={onEditar} onExcluir={onExcluir} />
    </li>
  );
}

/** O "…" da linha: Editar / Excluir. Fecha ao perder foco ou com Esc. */
function MenuAcoes({ onEditar, onExcluir }: { onEditar: () => void; onExcluir: () => void }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
    >
      <button
        type="button"
        aria-label="Mais ações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface hover:text-ink"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute top-full right-0 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAberto(false);
              onEditar();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface"
          >
            <Pencil className="size-4 text-ink-muted" /> Editar
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAberto(false);
              onExcluir();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="size-4" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function ConsultaModal({
  open,
  consulta,
  dataInicial,
  orgId,
  animais,
  veterinarios,
  onClose,
  onDone,
}: {
  open: boolean;
  consulta: Consulta | null;
  dataInicial: string;
  orgId: string;
  animais: Animal[];
  veterinarios: Veterinario[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const editando = consulta !== null;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const f = new FormData(e.currentTarget);
    const bruto = {
      animalId: f.get("animalId"),
      veterinarioId: f.get("veterinarioId") || null,
      data: f.get("data"),
      hora: f.get("hora"),
      duracaoMin: f.get("duracaoMin"),
      tipo: f.get("tipo"),
      observacoes: f.get("observacoes") || null,
      ...(editando && { status: f.get("status") }),
    };
    const parsed = editando
      ? atualizarConsultaSchema.safeParse(bruto)
      : criarConsultaSchema.safeParse(bruto);
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    start(async () => {
      const err = editando
        ? await chamarApi(`/api/org/${orgId}/consultas/${consulta.id}`, {
            method: "PATCH",
            body: JSON.stringify(parsed.data),
          })
        : await chamarApi(`/api/org/${orgId}/consultas`, {
            method: "POST",
            body: JSON.stringify(parsed.data),
          });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? "Editar consulta" : "Nova consulta"} wide>
      {animais.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Cadastre um animal antes de agendar — a consulta precisa estar ligada a um.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Animal" className="sm:col-span-2">
              <Select name="animalId" required defaultValue={consulta?.animalId ?? ""}>
                <option value="" disabled>
                  Escolha o animal
                </option>
                {animais.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} · {ROTULO_ESPECIE[a.especie]}
                    {a.tutor ? ` · ${a.tutor}` : ""}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Data">
              <input name="data" type="date" required className={inputClasses} defaultValue={consulta?.data ?? dataInicial} />
            </Campo>
            <Campo label="Hora">
              <input name="hora" type="time" required className={inputClasses} defaultValue={consulta?.hora ?? "09:00"} />
            </Campo>
            <Campo label="Tipo">
              <Select name="tipo" defaultValue={consulta?.tipo ?? "consulta"}>
                {TIPOS_CONSULTA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_CONSULTA[t]}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Duração">
              <Select name="duracaoMin" defaultValue={String(consulta?.duracaoMin ?? 30)}>
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Veterinário" className={editando ? "" : "sm:col-span-2"}>
              <Select name="veterinarioId" defaultValue={consulta?.veterinarioId ?? ""}>
                <option value="">Sem responsável definido</option>
                {veterinarios.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            {editando && (
              <Campo label="Status">
                <Select name="status" defaultValue={consulta.status}>
                  {STATUS_CONSULTA.map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_STATUS_CONSULTA[s]}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}
            <Campo label="Observações" className="sm:col-span-2">
              <textarea name="observacoes" rows={2} className={`${inputClasses} h-auto py-2.5`} defaultValue={consulta?.observacoes ?? ""} />
            </Campo>
          </div>

          {erro && (
            <p role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btn.secundario}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className={btn.primario}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {editando ? "Salvar" : "Agendar"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ExcluirModal({
  consulta,
  orgId,
  onClose,
  onDone,
}: {
  consulta: Consulta | null;
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function excluir() {
    if (!consulta) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/consultas/${consulta.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open={consulta !== null} onClose={onClose} title="Excluir consulta">
      {consulta && (
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Excluir a consulta de <strong>{consulta.animalNome}</strong> em{" "}
            {formatar(consulta.data, { day: "numeric", month: "long" })} às {consulta.hora}?
          </p>
          <p className="text-xs text-ink-muted">
            Isso apaga o registro. Se a consulta só não vai acontecer, prefira editar e marcar como
            cancelada — o histórico fica.
          </p>
          {erro && (
            <p role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btn.secundario}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={excluir}
              disabled={pending}
              className={btn.perigoSolido}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
