"use client";

import {
  ROTULO_ESPECIE,
  ROTULO_SEXO,
  ROTULO_TIPO_CONSULTA,
  rotuloAnimal,
  type Prontuario,
  type TipoConsulta,
} from "@vocare/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { btn } from "@/components/app/ui";
import { formatar, idade } from "@/lib/datas";

import { ProntuarioModal, type AnimalOpcao, type Veterinario } from "./prontuario-modal";

export type NovoAtendimento = {
  consultaId?: string;
  animalId: string;
  data: string;
  tipo: TipoConsulta;
  veterinarioId: string | null;
};

type Aba = "atendimento" | "remedios" | "exames";
const ABAS: { aba: Aba; rotulo: string }[] = [
  { aba: "atendimento", rotulo: "Atendimento" },
  { aba: "remedios", rotulo: "Remédios" },
  { aba: "exames", rotulo: "Exames" },
];

/** "AAAA-MM-DD" → "DD/MM". */
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Retorno como a gente fala: "hoje, 24/09 às 14:00", "sexta, 25/09 às 9:30". */
function quandoRetorno(r: { data: string; hora: string }, hoje: string) {
  const dia = r.data === hoje ? "hoje" : formatar(r.data, { weekday: "long" }).replace("-feira", "");
  return `${dia}, ${dm(r.data)} às ${r.hora.replace(/^0/, "")}`;
}

function info(p: Prontuario, hoje: string) {
  return [
    ROTULO_ESPECIE[p.animalEspecie],
    p.animalRaca,
    p.animalSexo && ROTULO_SEXO[p.animalSexo].toLowerCase(),
    idade(p.animalNascimento, hoje),
  ]
    .filter(Boolean)
    .join(" · ");
}

type Props = {
  orgId: string;
  hoje: string;
  prontuarios: Prontuario[];
  animais: AnimalOpcao[];
  veterinarios: Veterinario[];
  eu: string;
  podeApagar: boolean;
  selecionarId?: string;
  /** Abre o formulário de atendimento novo já preenchido. */
  nova?: NovoAtendimento;
};

export function ProntuariosView({ orgId, hoje, prontuarios, animais, veterinarios, eu, podeApagar, selecionarId, nova }: Props) {
  const router = useRouter();
  const [selecionadoId, setSelecionadoId] = useState(selecionarId);
  const [aba, setAba] = useState<Aba>("atendimento");
  const [modal, setModal] = useState<{ prontuario: Prontuario | null; inicial?: NovoAtendimento } | null>(
    nova ? { prontuario: null, inicial: nova } : null,
  );

  // Link novo (?id=) com a tela já aberta: segue o link.
  const [anterior, setAnterior] = useState(selecionarId);
  if (anterior !== selecionarId) {
    setAnterior(selecionarId);
    setSelecionadoId(selecionarId);
    setAba("atendimento");
  }

  const atual = prontuarios.find((p) => p.id === selecionadoId) ?? prontuarios[0];

  function fechar() {
    setModal(null);
    // Tira ?consulta= da barra para um F5 não abrir o formulário de novo.
    if (nova) router.replace("/prontuarios");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Prontuários</h1>
          <p className="text-base text-ink-muted">O registro completo de cada atendimento.</p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ prontuario: null, inicial: { animalId: "", data: hoje, tipo: "consulta", veterinarioId: eu } })}
          className={btn.secundario}
        >
          Registrar atendimento
        </button>
      </div>

      {!atual ? (
        <div className="flex max-w-xl flex-col gap-1.5 py-6">
          <p className="text-lg font-semibold text-ink">Nenhum atendimento registrado ainda</p>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Na agenda, abra o menu da consulta e escolha “Registrar atendimento”. Atendimento que não estava agendado entra
            pelo botão acima.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-7">
          <ul aria-label="Atendimentos" className="flex max-w-[320px] min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
            {prontuarios.map((p) => {
              const ativo = p.id === atual.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelecionadoId(p.id);
                      setAba("atendimento");
                    }}
                    aria-current={ativo ? "true" : undefined}
                    className={`flex w-full cursor-pointer flex-col gap-[3px] rounded-field px-3.5 py-3 text-left transition ${ativo ? "bg-surface" : "hover:bg-hover"}`}
                  >
                    <span className="flex justify-between gap-2 text-[15px]">
                      <span className="truncate font-semibold text-ink">{rotuloAnimal({ numero: p.animalNumero, nome: p.animalNome })}</span>
                      <span className="shrink-0 text-ink-muted tabular-nums">{dm(p.data)}</span>
                    </span>
                    <span className="truncate text-sm text-ink-muted">{ROTULO_TIPO_CONSULTA[p.tipo]}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Detalhe
            p={atual}
            hoje={hoje}
            aba={aba}
            onAba={setAba}
            onEditar={() => setModal({ prontuario: atual })}
          />
        </div>
      )}

      {modal && (
        <ProntuarioModal
          orgId={orgId}
          prontuario={modal.prontuario}
          inicial={modal.inicial}
          animais={animais}
          veterinarios={veterinarios}
          podeApagar={podeApagar}
          onClose={fechar}
          onDone={(r) => {
            fechar();
            if (r?.id) setSelecionadoId(r.id);
            if (r?.removido) setSelecionadoId(undefined);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Detalhe({
  p,
  hoje,
  aba,
  onAba,
  onEditar,
}: {
  p: Prontuario;
  hoje: string;
  aba: Aba;
  onAba: (a: Aba) => void;
  onEditar: () => void;
}) {
  const semNada = !p.queixa && !p.exame.length && !p.diagnostico;
  return (
    <section
      aria-label={`Atendimento de ${rotuloAnimal({ numero: p.animalNumero, nome: p.animalNome })}`}
      className="flex min-w-0 flex-[999_1_28rem] flex-col gap-[18px] rounded-card border border-line bg-white px-6 py-[22px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-semibold text-ink">{rotuloAnimal({ numero: p.animalNumero, nome: p.animalNome })}</h2>
          {info(p, hoje) && <p className="text-[15px] text-ink-muted">{info(p, hoje)}</p>}
          <p className="text-[15px] text-ink-muted">
            {ROTULO_TIPO_CONSULTA[p.tipo]} em {dm(p.data)}
            {p.veterinarioNome && ` · ${p.veterinarioNome}`}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <button type="button" onClick={onEditar} className={btn.link}>
            Editar
          </button>
          <Link href={`/animais/${p.animalId}`} className={`${btn.link} no-underline`}>
            Ver ficha do animal
          </Link>
        </div>
      </div>

      <div role="tablist" aria-label="Parte do atendimento" className="flex gap-6 border-b border-line">
        {ABAS.map((t) => {
          const ativo = t.aba === aba;
          return (
            <button
              key={t.aba}
              type="button"
              role="tab"
              id={`aba-${t.aba}`}
              aria-selected={ativo}
              aria-controls="painel-prontuario"
              onClick={() => onAba(t.aba)}
              className={`-mb-px cursor-pointer border-b-2 pb-2.5 text-[15px] transition ${
                ativo ? "border-ink font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.rotulo}
            </button>
          );
        })}
      </div>

      <div id="painel-prontuario" role="tabpanel" aria-labelledby={`aba-${aba}`} className="flex flex-col gap-[18px]">
        {aba === "atendimento" && (
          <>
            {p.queixa && (
              <Bloco titulo="Queixa e histórico">
                <p className="text-base leading-relaxed whitespace-pre-line text-ink">{p.queixa}</p>
              </Bloco>
            )}
            {p.exame.length > 0 && (
              <Bloco titulo="Exame físico">
                <dl className="flex flex-wrap gap-x-7 gap-y-2">
                  {p.exame.map((x) => (
                    <div key={x.nome} className="flex flex-col">
                      <dt className="text-[13px] text-ink-muted">{x.nome}</dt>
                      <dd className="text-base font-semibold text-ink tabular-nums">{x.valor}</dd>
                    </div>
                  ))}
                </dl>
              </Bloco>
            )}
            {p.diagnostico && (
              <Bloco titulo="Diagnóstico">
                <p className="text-base leading-relaxed whitespace-pre-line text-ink">{p.diagnostico}</p>
              </Bloco>
            )}
            {semNada && <p className="text-[15px] text-ink-muted">Nada anotado sobre o atendimento. Veja as outras abas.</p>}
            {p.retorno && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <span className="text-[15px]">
                  <span className="text-ink-muted">Retorno: </span>
                  <b className="font-semibold text-ink">{quandoRetorno(p.retorno, hoje)}</b>
                </span>
                <Link href={`/agenda?dia=${p.retorno.data}`} className={`${btn.link} no-underline`}>
                  Ver na agenda
                </Link>
              </div>
            )}
          </>
        )}

        {aba === "remedios" &&
          (p.remedios.length ? (
            <ul className="flex flex-col">
              {p.remedios.map((m, i) => (
                <li key={i} className="flex flex-col gap-0.5 border-b border-line-soft py-3">
                  <span className="text-base font-semibold text-ink">{m.nome}</span>
                  {m.como && <span className="text-[15px] text-ink-muted">{m.como}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-ink-muted">Nenhum remédio receitado.</p>
          ))}

        {aba === "exames" &&
          (p.exames.length ? (
            <ul className="flex flex-col">
              {p.exames.map((m, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-line-soft py-3">
                  <span className="text-base text-ink">{m.nome}</span>
                  {m.resultado ? (
                    <span className="text-right text-[15px] font-semibold text-brand-ink">{m.resultado}</span>
                  ) : (
                    <span className="text-right text-[15px] font-semibold text-warn">Esperando resultado</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-ink-muted">Nenhum exame pedido.</p>
          ))}
      </div>
    </section>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold text-ink-muted">{titulo}</h3>
      {children}
    </div>
  );
}
