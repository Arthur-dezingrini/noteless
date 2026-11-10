import { ROTULO_STATUS_CONSULTA, ROTULO_TIPO_CONSULTA, rotuloAnimal, type Aviso, type Consulta, type GalpaoHoje, type StatusConsulta } from "@vocare/shared";
import type { Route } from "next";
import Link from "next/link";

import { buttonClass, Card, Dot, PageHeader, SectionHeader, StatusText, type Tom } from "@/components/ui";
import { diaCurto, TZ } from "@/lib/datas";
import { GalpoesHoje } from "@/modulos/aviario";

function saudacao(date: Date): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: TZ }).format(date));
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const TOM_STATUS: Record<StatusConsulta, Tom> = {
  agendada: "aviso",
  confirmada: "ok",
  urgente: "perigo",
  concluida: "neutro",
  cancelada: "neutro",
};

/** Início: o que precisa de você hoje. */
export function Inicio({
  hoje,
  primeiroNome,
  pendentes,
  doDia,
  avisos,
  galpoes,
}: {
  hoje: string;
  primeiroNome: string;
  pendentes: number;
  doDia: Consulta[];
  avisos: Aviso[];
  galpoes: GalpaoHoje[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={diaCurto(hoje)} title={`${saudacao(new Date())}, ${primeiroNome}`} />

      {pendentes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-white px-5 py-4">
          <p className="flex items-center gap-3 text-base text-ink">
            <Dot tone="aviso" />
            <span>
              <b className="font-semibold">
                {pendentes} {pendentes === 1 ? "nota" : "notas"}
              </b>{" "}
              esperando você conferir
            </span>
          </p>
          <Link href="/notas" className={buttonClass("secundario")}>
            Conferir agora
          </Link>
        </div>
      )}

      <GalpoesHoje galpoes={galpoes} />

      <div className="flex flex-wrap items-start gap-7">
        <section className="flex min-w-0 flex-[999_1_30rem] flex-col gap-2.5">
          <SectionHeader
            title="Hoje"
            action={
              <Link href="/saude/agenda" className="text-[15px] font-semibold no-underline">
                Ver agenda
              </Link>
            }
          />
          <Card>
            {doDia.length === 0 ? (
              <p className="px-5 py-6 text-[15px] text-ink-muted">Nada marcado para hoje.</p>
            ) : (
              doDia.map((c, i) => (
                <div key={c.id} className={`flex items-center gap-4 px-5 py-3.5 ${i ? "border-t border-line" : ""}`}>
                  <span className="w-12 shrink-0 text-[15px] font-semibold text-ink tabular-nums">{c.hora}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {c.animalId ? (
                      <Link href={`/animais/${c.animalId}`} className="truncate text-[15px] font-semibold text-ink no-underline hover:underline">
                        {rotuloAnimal({ numero: c.animalNumero, nome: c.animalNome })}
                      </Link>
                    ) : (
                      <span className="truncate text-[15px] font-semibold text-ink">{c.animalNome}</span>
                    )}
                    <span className="truncate text-sm text-ink-muted">
                      {[ROTULO_TIPO_CONSULTA[c.tipo], c.local].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <StatusText tone={TOM_STATUS[c.status]}>{ROTULO_STATUS_CONSULTA[c.status]}</StatusText>
                </div>
              ))
            )}
          </Card>
        </section>

        <section className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2.5">
          <SectionHeader title="Fique de olho" />
          {avisos.length === 0 ? (
            <p className="border-t border-line py-3.5 text-[15px] text-ink-muted">Tudo em dia.</p>
          ) : (
            <ul className="flex flex-col border-t border-line">
              {avisos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.link as Route}
                    className="flex gap-2.5 border-b border-line py-3.5 text-[15px] leading-relaxed text-ink no-underline hover:text-brand-ink"
                  >
                    <span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 rounded-full ${a.tom === "danger" ? "bg-danger" : "bg-warn-dot"}`} />
                    {a.texto}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
