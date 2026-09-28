"use client";

import { ROTULO_ESPECIE, ROTULO_SEXO, type Evento, type FichaAnimal, type TipoEvento } from "@vocare/shared";
import { ChevronLeft, Mic } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatar, idade } from "@/lib/datas";

import { AnimalModal } from "../animal-modal";

/** As abas do histórico e os tipos de registro que cada uma junta. */
const ABAS: { chave: string; rotulo: string; tipos: TipoEvento[] }[] = [
  { chave: "tudo", rotulo: "Tudo", tipos: [] },
  { chave: "vacina", rotulo: "Vacinas", tipos: ["vacina"] },
  { chave: "pesagem", rotulo: "Pesagens", tipos: ["pesagem"] },
  { chave: "consulta", rotulo: "Consultas e remédios", tipos: ["consulta", "tratamento"] },
  { chave: "parto", rotulo: "Partos", tipos: ["parto"] },
  { chave: "anotacao", rotulo: "Anotações", tipos: ["anotacao"] },
];

/** "AAAA-MM-DD" → "DD/MM/AAAA". */
const dma = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function FichaView({
  orgId,
  ficha,
  hoje,
  possoRemover,
}: {
  orgId: string;
  ficha: FichaAnimal;
  hoje: string;
  possoRemover: boolean;
}) {
  const router = useRouter();
  const { animal: a, grupos, historico, proximos, pendencias, ocorrenciasPendentes } = ficha;
  const [aba, setAba] = useState("tudo");
  const [editando, setEditando] = useState(false);

  const situacao =
    a.status === "inativo"
      ? { rotulo: "Inativo", cor: "text-ink-muted" }
      : a.emTratamento
        ? { rotulo: "Em tratamento", cor: "text-warn" }
        : { rotulo: "Ativo", cor: "text-brand-ink" };

  const peso = a.pesoKg != null ? `${a.pesoKg.toLocaleString("pt-BR")} kg` : null;
  const meta = [ROTULO_ESPECIE[a.especie], a.raca, a.sexo && ROTULO_SEXO[a.sexo].toLowerCase(), idade(a.nascimento), peso].filter(Boolean);
  const nomeCurto = a.nome || `nº ${a.numero}`;
  const de = a.sexo === "femea" ? "a" : "o";

  const abas = ABAS.filter((t) => t.chave === "tudo" || historico.some((e) => t.tipos.includes(e.tipo)));
  const atual = abas.find((t) => t.chave === aba) ?? abas[0]!;
  const visiveis = atual.tipos.length ? historico.filter((e) => atual.tipos.includes(e.tipo)) : historico;

  const dados = [
    ["Espécie", ROTULO_ESPECIE[a.especie]],
    ["Raça", a.raca],
    ["Sexo", a.sexo && ROTULO_SEXO[a.sexo]],
    ["Nascimento", a.nascimento && `${dma(a.nascimento)}${idade(a.nascimento) ? ` (${idade(a.nascimento)})` : ""}`],
    ["Peso", peso],
    ["Onde fica", a.local],
    ["Grupos", grupos.map((g) => g.nome).join(", ")],
    ["Microchip", a.microchip],
    ["Tutor", [a.tutor, a.tutorTelefone].filter(Boolean).join(" · ")],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/animais" className="flex items-center gap-1.5 self-start text-[15px] font-semibold text-ink-soft no-underline hover:text-ink">
        <ChevronLeft className="size-4" /> Animais
      </Link>

      <div className="-mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="flex items-baseline gap-2.5 text-[28px] leading-tight font-semibold tracking-tight text-ink">
            {a.numero && <span className="text-[22px] font-medium text-ink-muted">nº {a.numero}</span>}
            {a.nome}
          </h1>
          <p className="text-base text-ink-muted">
            {meta.join(" · ")}
            {meta.length > 0 && " · "}
            <span className={`font-semibold ${situacao.cor}`}>{situacao.rotulo}</span>
          </p>
        </div>
        <button type="button" onClick={() => setEditando(true)} className="h-[42px] cursor-pointer rounded-field px-3.5 text-[15px] font-semibold text-ink hover:bg-hover">
          Editar dados
        </button>
      </div>

      {ocorrenciasPendentes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-[15px] text-ink">
          <span>
            {ocorrenciasPendentes} {ocorrenciasPendentes === 1 ? "ocorrência" : "ocorrências"} sobre {de} {nomeCurto} esperando
            conferência. Só entra no histórico depois de salva.
          </span>
          <Link href="/ocorrencias" className="font-semibold text-ink underline underline-offset-[3px]">
            Conferir
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-7">
        <section className="flex min-w-0 flex-[999_1_30rem] flex-col gap-3.5">
          <div role="tablist" aria-label="Tipo de registro" className="flex flex-wrap gap-x-[22px] border-b border-line">
            {abas.map((t) => {
              const n = t.tipos.length ? historico.filter((e) => t.tipos.includes(e.tipo)).length : null;
              const ativo = t.chave === atual.chave;
              return (
                <button
                  key={t.chave}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => setAba(t.chave)}
                  className={`-mb-px flex cursor-pointer gap-1.5 border-b-2 pb-[11px] text-[15px] ${
                    ativo ? "border-ink font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {t.rotulo}
                  {n !== null && <span className="font-medium text-ink-muted">{n}</span>}
                </button>
              );
            })}
          </div>

          {visiveis.length === 0 ? (
            <p className="py-7 text-[15px] text-ink-muted">Nada registrado aqui ainda.</p>
          ) : (
            <ol className="flex flex-col">
              {visiveis.map((e) => (
                <LinhaHistorico key={e.id} e={e} />
              ))}
            </ol>
          )}
        </section>

        <aside className="flex min-w-0 flex-[1_1_16rem] flex-col gap-[22px]">
          {pendencias.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-ink-muted">Precisa de atenção</h2>
              {pendencias.map((p) => (
                <p key={p.id} className="flex gap-2.5 text-[15px] leading-relaxed text-ink">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-danger" />
                  {p.texto}
                </p>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink-muted">Próximos</h2>
            {proximos.length === 0 ? (
              <p className="text-[15px] text-ink-muted">Nada marcado.</p>
            ) : (
              proximos.map((p) => (
                <div key={p.id} className="flex justify-between gap-3 border-b border-line-soft py-2 text-[15px]">
                  <span className="text-ink">{p.titulo}</span>
                  <span className="shrink-0 text-ink-muted tabular-nums">
                    {p.data === hoje ? "hoje" : p.data.slice(0, 4) === hoje.slice(0, 4) ? formatar(p.data, { day: "2-digit", month: "2-digit" }) : dma(p.data)}
                  </span>
                </div>
              ))
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink-muted">Dados</h2>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
              {dados.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      {editando && (
        <AnimalModal
          animal={a}
          orgId={orgId}
          possoRemover={possoRemover}
          onClose={() => setEditando(false)}
          onDone={(r) => {
            setEditando(false);
            if (r?.removido) router.push("/animais");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function LinhaHistorico({ e }: { e: Evento }) {
  return (
    <li className="flex gap-[18px] border-b border-line-soft py-3.5">
      <span className="w-[86px] shrink-0 pt-px text-sm text-ink-muted tabular-nums">{dma(e.data)}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-[15px] font-semibold text-ink">{e.titulo}</span>
          {e.novo && <span className="text-[13px] font-semibold text-brand-ink">Novo</span>}
        </div>
        {(e.detalhe || (e.por && !e.ocorrenciaId)) && (
          <span className="text-sm leading-relaxed text-ink-soft">
            {[e.detalhe, !e.ocorrenciaId && e.por && `por ${e.por}`].filter(Boolean).join(" · ")}
          </span>
        )}
        {e.prontuarioId && (
          <Link href={`/prontuarios?id=${e.prontuarioId}`} className="w-fit text-sm font-semibold text-brand-ink no-underline hover:underline">
            Ver atendimento
          </Link>
        )}
        {e.ocorrenciaId && (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <Mic className="size-[13px]" aria-hidden="true" />
            {e.por ? `Por áudio de ${e.por}` : "Por áudio"}
          </span>
        )}
      </div>
    </li>
  );
}
