"use client";

import {
  ROTULO_STATUS_CONSULTA,
  ROTULO_TIPO_CONSULTA,
  TIPOS_CONSULTA,
  atualizarConsultaSchema,
  criarConsultaSchema,
  rotuloAnimal,
  type Animal,
  type Consulta,
  type StatusConsulta,
} from "@vocare/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";

import { Button, buttonClass, Card, cx, Field, FormMessage, Input, Menu, MenuItem, Modal, ModalFooter, PageHeader, SectionHeader, SegmentedControl, Select, StatusText, type Tom } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { adicionarDias, formatar, inicioDaSemana, paraDate } from "@/lib/datas";

import { Calendario } from "./calendario";

type Modo = "dia" | "semana";
type Veterinario = { id: string; nome: string };
/** Pré-preenchimento da consulta nova (ex.: "Marcar na agenda" do relatório de vacinas). */
export type NovaConsulta = {
  animalId?: string;
  tipoConsulta?: string;
  observacoes?: string;
};
type Dialogo = ({ tipo: "nova"; data: string } & NovaConsulta) | { tipo: "remarcar"; consulta: Consulta } | null;

const TOM_STATUS: Record<StatusConsulta, Tom> = {
  agendada: "aviso",
  confirmada: "ok",
  urgente: "perigo",
  concluida: "neutro",
  cancelada: "neutro",
};

const DURACOES = [15, 30, 45, 60, 120];

function duracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h ${min % 60} min`;
}

function nomeAlvo(c: Consulta) {
  return c.animalId ? rotuloAnimal({ numero: c.animalNumero, nome: c.animalNome }) : c.animalNome;
}

/** "Quinta, 24 de setembro · hoje" */
function tituloDia(iso: string, hoje: string) {
  const semana = formatar(iso, { weekday: "long" }).replace("-feira", "");
  const s = `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${formatar(iso, { day: "numeric", month: "long" })}`;
  return iso === hoje ? `${s} · hoje` : s;
}

/** A consulta inteira de volta, com o que mudou — o PATCH da api espera tudo. */
function comMudanca(c: Consulta, m: Partial<Pick<Consulta, "data" | "hora" | "status">>) {
  return {
    animalId: c.animalId ?? null,
    grupoId: c.grupoId ?? null,
    veterinarioId: c.veterinarioId ?? null,
    data: m.data ?? c.data,
    hora: m.hora ?? c.hora,
    duracaoMin: c.duracaoMin,
    tipo: c.tipo,
    status: m.status ?? c.status,
    observacoes: c.observacoes ?? null,
  };
}

type Props = {
  orgId: string;
  hoje: string;
  /** Dia aberto ao entrar (?dia=, vindo do "Ver na agenda"). */
  dia?: string;
  consultas: Consulta[];
  animais: Animal[];
  veterinarios: Veterinario[];
  /** Abre a janela de consulta nova já preenchida. */
  novaPara?: NovaConsulta;
};

export function AgendaView({ orgId, hoje, dia, consultas: iniciais, animais, veterinarios, novaPara }: Props) {
  const router = useRouter();
  const [consultas, setConsultas] = useState(iniciais);
  const [selecionado, setSelecionado] = useState(dia ?? hoje);
  const [modo, setModo] = useState<Modo>("dia");
  const [dialogo, setDialogo] = useState<Dialogo>(novaPara ? { tipo: "nova", data: hoje, ...novaPara } : null);
  const [erro, setErro] = useState<string | null>(null);
  const [{ ano, mes }, setMesVisivel] = useState(() => {
    const d = dia ?? hoje;
    return { ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) };
  });

  // Depois de salvar, o servidor manda a lista nova; a tela acompanha.
  const [anteriores, setAnteriores] = useState(iniciais);
  if (anteriores !== iniciais) {
    setAnteriores(iniciais);
    setConsultas(iniciais);
  }

  const diasComConsulta = useMemo(() => new Set(consultas.filter((c) => c.status !== "cancelada").map((c) => c.data)), [consultas]);

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
    setMesVisivel({
      ano: Number(iso.slice(0, 4)),
      mes: Number(iso.slice(5, 7)),
    });
  }

  /** Atualiza na hora (otimista) e confirma com a api; se falhar, volta. */
  async function atualizar(c: Consulta, m: Partial<Pick<Consulta, "data" | "hora" | "status">>) {
    setErro(null);
    const antes = consultas;
    setConsultas((l) => l.map((x) => (x.id === c.id ? { ...x, ...m } : x)));
    const err = await chamarApi(`/api/org/${orgId}/consultas/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify(comMudanca(c, m)),
    });
    if (err) {
      setConsultas(antes);
      setErro(err);
      return;
    }
    router.refresh();
  }

  const doDia = consultas.filter((c) => c.data === selecionado).sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description={modo === "dia" ? "Consultas, retornos e vacinas marcados." : "Arraste para remarcar."}
        actions={
          <div className="flex items-center gap-3">
            <SegmentedControl
              label="Ver por"
              value={modo}
              onChange={setModo}
              items={[
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
              ]}
            />
            <Button onClick={() => setDialogo({ tipo: "nova", data: selecionado })}>Nova consulta</Button>
          </div>
        }
      />

      {erro && <FormMessage>{erro}</FormMessage>}

      {modo === "dia" ? (
        <div className="flex flex-wrap items-start gap-7">
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
          <section className="flex min-w-0 flex-[1_1_27rem] flex-col gap-2.5">
            <SectionHeader title={tituloDia(selecionado, hoje)} />
            {doDia.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-button-border p-8 text-center">
                <p className="text-base text-ink-soft">Nada marcado neste dia.</p>
                <Button onClick={() => setDialogo({ tipo: "nova", data: selecionado })}>Marcar consulta</Button>
              </div>
            ) : (
              <Card as="ul">
                {doDia.map((c, i) => (
                  <LinhaConsulta
                    key={c.id}
                    c={c}
                    primeira={i === 0}
                    onConcluir={() => atualizar(c, { status: "concluida" })}
                    onCancelar={() => atualizar(c, { status: "cancelada" })}
                    onReabrir={() => atualizar(c, { status: "agendada" })}
                    onRemarcar={() => setDialogo({ tipo: "remarcar", consulta: c })}
                  />
                ))}
              </Card>
            )}
          </section>
        </div>
      ) : (
        <Semana
          consultas={consultas}
          hoje={hoje}
          inicio={inicioDaSemana(selecionado)}
          onMudarSemana={(dias) => selecionar(adicionarDias(selecionado, dias))}
          onMover={(c, data) => c.data !== data && atualizar(c, { data })}
        />
      )}

      {dialogo && (
        <ConsultaModal
          dialogo={dialogo}
          orgId={orgId}
          animais={animais}
          veterinarios={veterinarios}
          onClose={() => setDialogo(null)}
          onDone={(data) => {
            setDialogo(null);
            if (data) selecionar(data);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LinhaConsulta({
  c,
  primeira,
  onConcluir,
  onCancelar,
  onReabrir,
  onRemarcar,
}: {
  c: Consulta;
  primeira: boolean;
  onConcluir: () => void;
  onCancelar: () => void;
  onReabrir: () => void;
  onRemarcar: () => void;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const caixa = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const fechada = c.status === "concluida" || c.status === "cancelada";
  const acoes: { rotulo: string; fazer: () => void; perigo?: boolean }[] = [
    ...(!fechada ? [{ rotulo: "Marcar como concluída", fazer: onConcluir }] : []),
    { rotulo: "Remarcar", fazer: onRemarcar },
    ...(c.prontuarioId
      ? [
          {
            rotulo: "Ver atendimento",
            fazer: () => router.push(`/prontuarios?id=${c.prontuarioId}`),
          },
        ]
      : c.animalId && c.status !== "cancelada"
        ? [
            {
              rotulo: "Registrar atendimento",
              fazer: () => router.push(`/prontuarios?consulta=${c.id}`),
            },
          ]
        : []),
    ...(c.animalId
      ? [
          {
            rotulo: "Ver ficha do animal",
            fazer: () => router.push(`/animais/${c.animalId}`),
          },
        ]
      : []),
    ...(fechada
      ? [{ rotulo: "Voltar para agendada", fazer: onReabrir }]
      : [{ rotulo: "Cancelar consulta", fazer: onCancelar, perigo: true }]),
  ];

  return (
    <li ref={caixa} className={cx("relative flex items-center gap-3.5 py-3.5 pr-3 pl-[18px]", !primeira && "border-t border-line")}>
      <span className="flex w-[52px] shrink-0 flex-col">
        <span className="text-[15px] font-semibold text-ink tabular-nums">{c.hora}</span>
        <span className="text-[13px] text-ink-muted">{duracao(c.duracaoMin)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {c.animalId ? (
          <Link href={`/animais/${c.animalId}`} className="truncate text-[15px] font-semibold text-ink no-underline hover:underline">
            {nomeAlvo(c)}
          </Link>
        ) : (
          <span className="truncate text-[15px] font-semibold text-ink">{nomeAlvo(c)}</span>
        )}
        <span className="truncate text-sm text-ink-muted">
          {[ROTULO_TIPO_CONSULTA[c.tipo], c.local].filter(Boolean).join(" · ")}
          {c.observacoes && <span className="hidden sm:inline"> · {c.observacoes}</span>}
        </span>
      </span>
      <span className="hidden w-28 truncate text-sm text-ink-soft xl:block">{c.veterinarioNome ?? "—"}</span>
      <span className="w-24">
        <StatusText tone={TOM_STATUS[c.status]}>{ROTULO_STATUS_CONSULTA[c.status]}</StatusText>
      </span>
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-label={`Mais ações: ${nomeAlvo(c)} às ${c.hora}`}
        aria-expanded={menu}
        className={buttonClass("iconePequeno", cx("text-lg leading-none text-ink-muted", menu && "bg-surface"))}
      >
        …
      </button>
      {menu && (
        <Menu className="absolute top-[50px] right-3">
          {acoes.map((a) => (
            <MenuItem
              key={a.rotulo}
              danger={a.perigo}
              onClick={() => {
                setMenu(false);
                a.fazer();
              }}
            >
              {a.rotulo}
            </MenuItem>
          ))}
        </Menu>
      )}
    </li>
  );
}

/** Semana de segunda a sexta (sábado e domingo aparecem se tiverem algo). Arrastar remarca. */
function Semana({
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

function ConsultaModal({
  dialogo,
  orgId,
  animais,
  veterinarios,
  onClose,
  onDone,
}: {
  dialogo: NonNullable<Dialogo>;
  orgId: string;
  animais: Animal[];
  veterinarios: Veterinario[];
  onClose: () => void;
  onDone: (data?: string) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const consulta = dialogo.tipo === "remarcar" ? dialogo.consulta : null;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const f = new FormData(e.currentTarget);
    const bruto = {
      animalId: consulta && !consulta.animalId ? null : f.get("animalId"),
      grupoId: consulta?.grupoId ?? null,
      veterinarioId: f.get("veterinarioId") || null,
      data: f.get("data"),
      hora: f.get("hora"),
      duracaoMin: f.get("duracaoMin"),
      tipo: f.get("tipo"),
      observacoes: f.get("observacoes") || null,
      ...(consulta && {
        status: consulta.status === "cancelada" ? "agendada" : consulta.status,
      }),
    };
    const parsed = consulta ? atualizarConsultaSchema.safeParse(bruto) : criarConsultaSchema.safeParse(bruto);
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    start(async () => {
      const err = consulta
        ? await chamarApi(`/api/org/${orgId}/consultas/${consulta.id}`, {
            method: "PATCH",
            body: JSON.stringify(parsed.data),
          })
        : await chamarApi(`/api/org/${orgId}/consultas`, {
            method: "POST",
            body: JSON.stringify(parsed.data),
          });
      if (err) return setErro(err);
      onDone(parsed.data.data);
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={consulta ? "Remarcar consulta" : "Nova consulta"}
      subtitle={consulta ? "Muda o dia, a hora ou quem vai atender." : "Aparece na agenda de quem for atender."}
      wide
    >
      {animais.length === 0 && !consulta ? (
        <p className="text-[15px] text-ink-muted">Cadastre um animal antes de marcar — a consulta precisa estar ligada a um.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {consulta && !consulta.animalId ? (
              <Field label="Grupo" wide>
                <Input value={consulta.animalNome} disabled />
              </Field>
            ) : (
              <Field label="Animal" wide>
                <Select
                  name="animalId"
                  required
                  defaultValue={consulta?.animalId ?? (dialogo.tipo === "nova" ? dialogo.animalId : undefined) ?? ""}
                >
                  <option value="" disabled>
                    Escolha o animal
                  </option>
                  {animais.map((a) => (
                    <option key={a.id} value={a.id}>
                      {rotuloAnimal(a)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Data">
              <Input name="data" type="date" required defaultValue={consulta?.data ?? (dialogo.tipo === "nova" ? dialogo.data : "")} />
            </Field>
            <Field label="Hora">
              <Input name="hora" type="time" required defaultValue={consulta?.hora ?? "10:00"} />
            </Field>
            <Field label="Tipo">
              <Select
                name="tipo"
                defaultValue={consulta?.tipo ?? (dialogo.tipo === "nova" ? dialogo.tipoConsulta : undefined) ?? "consulta"}
              >
                {TIPOS_CONSULTA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_CONSULTA[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duração">
              <Select name="duracaoMin" defaultValue={String(consulta?.duracaoMin ?? 30)}>
                {[...new Set([...DURACOES, consulta?.duracaoMin ?? 30])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {duracao(m)}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Quem vai atender" wide>
              <Select name="veterinarioId" defaultValue={consulta?.veterinarioId ?? ""}>
                <option value="">Ninguém definido</option>
                {veterinarios.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observações" hint="(opcional)" wide>
              <Input
                name="observacoes"
                placeholder="Algo que quem vai atender precisa saber"
                defaultValue={consulta?.observacoes ?? (dialogo.tipo === "nova" ? dialogo.observacoes : undefined) ?? ""}
              />
            </Field>
          </div>

          {erro && <FormMessage>{erro}</FormMessage>}

          <ModalFooter>
            <Button variant="fantasma" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primario" loading={pending}>
              {consulta ? "Salvar" : "Marcar consulta"}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
