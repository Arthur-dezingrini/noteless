import { ROTULO_STATUS_CONSULTA, ROTULO_TIPO_CONSULTA, rotuloAnimal, type StatusConsulta } from "@vocare/shared";
import Link from "next/link";

import { getAvisos, getConsultas, getOcorrencias, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { diaCurto, hojeISO, TZ } from "@/lib/datas";

export const metadata = { title: "Início" };

function saudacao(date: Date): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: TZ }).format(date));
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const COR_STATUS: Record<StatusConsulta, string> = {
  agendada: "text-warn",
  confirmada: "text-brand-ink",
  urgente: "text-danger",
  concluida: "text-ink-muted",
  cancelada: "text-ink-muted",
};

/** Início: o que precisa de você hoje. */
export default async function InicioPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const hoje = hojeISO();

  const [consultas, ocorrencias, avisos] = org
    ? await Promise.all([getConsultas(org.id, hoje, hoje), getOcorrencias(org.id), getAvisos(org.id)])
    : [[], [], []];
  const pendentes = ocorrencias.filter((o) => o.status === "pendente").length;
  const doDia = consultas.filter((c) => c.status !== "cancelada");
  const primeiroNome = (user.name || user.email).split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] text-ink-muted">{diaCurto(hoje)}</p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">
          {saudacao(new Date())}, {primeiroNome}
        </h1>
      </div>

      {pendentes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-white px-5 py-4">
          <p className="flex items-center gap-3 text-base text-ink">
            <span aria-hidden="true" className="size-2 rounded-full bg-warn-dot" />
            <span>
              <b className="font-semibold">
                {pendentes} {pendentes === 1 ? "ocorrência" : "ocorrências"}
              </b>{" "}
              esperando você conferir
            </span>
          </p>
          <Link
            href="/ocorrencias"
            className="inline-flex h-10 items-center rounded-field border border-button-border bg-white px-3.5 text-[15px] font-semibold text-ink no-underline hover:bg-hover"
          >
            Conferir agora
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-7">
        <section className="flex min-w-0 flex-[999_1_30rem] flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-ink">Hoje</h2>
            <Link href="/agenda" className="text-[15px] font-semibold no-underline">
              Ver agenda
            </Link>
          </div>
          <div className="rounded-card border border-line bg-white">
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
                  <span className={`text-sm font-semibold ${COR_STATUS[c.status]}`}>{ROTULO_STATUS_CONSULTA[c.status]}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="flex min-w-0 flex-[1_1_16rem] flex-col gap-2.5">
          <h2 className="text-lg font-semibold text-ink">Fique de olho</h2>
          {avisos.length === 0 ? (
            <p className="border-t border-line py-3.5 text-[15px] text-ink-muted">Tudo em dia.</p>
          ) : (
            <ul className="flex flex-col border-t border-line">
              {avisos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.link}
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
