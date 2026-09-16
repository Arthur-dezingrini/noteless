"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/app/avatar";
import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";

type Prontuario = {
  id: string;
  animal: string;
  tutor: string;
  especie: string;
  raca: string;
  tipo: string;
  profissional: string;
  data: string;
  resumo: string;
  queixa: string;
  exame: string;
  diagnostico: string;
  retorno?: string;
};

const PRONTUARIOS: Prontuario[] = [
  { id: "thor-2026-09-01", animal: "Thor", tutor: "Carlos Mendes", especie: "Cão", raca: "Golden Retriever", tipo: "Vacinação", profissional: "Dra. Ana Lima", data: "01/09/2026", resumo: "Aplicação de vacina antirrábica V10. Animal saudável, bom estado geral.", queixa: "Proprietário relata falta de apetite há 3 dias, letargia e vômito ocasional.", exame: "FC: 120 bpm|FR: 28 rpm|T°: 38,8°C|Peso: 41 kg|TPC: < 2s", diagnostico: "Suspeita de gastroenterite leve. Descartado corpo estranho.", retorno: "07/09/2026" },
  { id: "luna-2026-08-28", animal: "Luna", tutor: "Patrícia Souza", especie: "Gato", raca: "Siamês", tipo: "Consulta clínica", profissional: "Dra. Ana Lima", data: "28/08/2026", resumo: "Queixa de falta de apetite há 3 dias. Exame físico sem alterações relevantes.", queixa: "Tutora percebeu redução do apetite e maior tempo de repouso.", exame: "FC: 160 bpm|FR: 26 rpm|T°: 38,3°C|Peso: 4,2 kg|TPC: < 2s", diagnostico: "Hiporexia inespecífica. Monitorar ingestão hídrica e alimentar." },
  { id: "rex-2026-08-25", animal: "Rex", tutor: "André Oliveira", especie: "Cão", raca: "Labrador", tipo: "Pós-cirúrgico", profissional: "Dra. Ana Lima", data: "25/08/2026", resumo: "Retorno pós-cirurgia ortopédica. Cicatrização adequada.", queixa: "Retorno programado para avaliação da ferida cirúrgica.", exame: "FC: 96 bpm|FR: 22 rpm|T°: 38,4°C|Peso: 31,8 kg|TPC: < 2s", diagnostico: "Boa evolução pós-operatória, sem sinais de infecção." },
];

const ABAS = ["Histórico", "Prescrição", "Exames"] as const;
type Aba = (typeof ABAS)[number];

function DadosClinicos({ prontuario, aba }: { prontuario: Prontuario; aba: Aba }) {
  if (aba !== "Histórico") {
    return <div className="px-5 py-7 sm:px-8"><h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{aba}</h3><p className="mt-3 text-sm text-ink-muted">Não há {aba.toLocaleLowerCase("pt-BR")} registrado(s) para este atendimento.</p></div>;
  }

  return <div className="space-y-7 px-5 py-7 sm:px-8">
    <section><h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Queixas e anamnese</h3><p className="mt-3 text-sm leading-6 text-ink">{prontuario.queixa}</p></section>
    <section><h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Exame físico</h3><div className="mt-3 flex flex-wrap gap-2">{prontuario.exame.split("|").map((medida) => <span key={medida} className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink">{medida}</span>)}</div></section>
    <section><h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Diagnóstico / hipótese</h3><p className="mt-3 text-sm leading-6 text-ink">{prontuario.diagnostico}</p></section>
    {prontuario.retorno && <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-brand-soft px-5 py-4"><p className="text-sm font-semibold leading-5 text-brand">Retorno agendado<span className="block text-base">{prontuario.retorno}</span></p><a href="/agenda" className="rounded-lg border border-brand/30 bg-white px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand-soft">Ver na agenda</a></section>}
  </div>;
}

export default function ProntuariosPage() {
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState(PRONTUARIOS[0].id);
  const [aba, setAba] = useState<Aba>("Histórico");
  const prontuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return termo ? PRONTUARIOS.filter((p) => `${p.animal} ${p.tutor} ${p.tipo}`.toLocaleLowerCase("pt-BR").includes(termo)) : PRONTUARIOS;
  }, [busca]);
  const prontuario = PRONTUARIOS.find((item) => item.id === selecionado) ?? prontuariosFiltrados[0] ?? PRONTUARIOS[0];

  return <>
    <PageHeader title="Prontuários" subtitle="Histórico clínico dos animais" />
    <div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.1fr)]">
      <Card className="min-w-0 overflow-hidden py-4">
        <div className="px-4 pb-4 sm:px-5"><label className="relative block"><span className="sr-only">Buscar prontuário</span><Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-muted" /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar prontuário..." className="h-12 w-full rounded-xl border border-field-border bg-white pr-4 pl-11 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-field-border-focus focus:ring-2 focus:ring-brand/15" /></label></div>
        <ul className="border-t border-line">{prontuariosFiltrados.map((item) => {
          const ativo = item.id === prontuario.id;
          return <li key={item.id}><button type="button" onClick={() => { setSelecionado(item.id); setAba("Histórico"); }} className={`relative flex w-full gap-4 px-5 py-5 text-left transition hover:bg-surface ${ativo ? "bg-[#f7fcf9]" : "bg-white"}`}>
            {ativo && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-brand" />}<Avatar name={item.animal} className="size-12 bg-[#d8fae6] text-brand" /><div className="min-w-0 flex-1"><div className="flex gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-ink">{item.animal}</p><p className="truncate text-xs text-ink-muted">{item.tipo} · {item.tutor}</p></div><time className="shrink-0 text-xs text-ink-muted">{item.data}</time></div><p className="mt-3 text-xs leading-5 text-ink-muted">{item.resumo}</p></div>
          </button></li>;
        })}{prontuariosFiltrados.length === 0 && <li className="px-5 py-12 text-center text-sm text-ink-muted">Nenhum prontuário encontrado.</li>}</ul>
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 px-5 py-6 sm:px-8"><Avatar name={prontuario.animal} className="size-14 bg-[#d8fae6] text-lg text-brand" /><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-ink">{prontuario.animal}</h2><p className="text-xs text-ink-muted">{prontuario.especie} · {prontuario.raca} · Tutor: {prontuario.tutor}</p></div><div className="text-left sm:text-right"><time className="block text-xs text-ink-muted">{prontuario.data}</time><p className="mt-1 text-xs font-semibold text-brand">{prontuario.profissional}</p></div></div>
        <div className="flex border-y border-line px-3 sm:px-5">{ABAS.map((item) => <button key={item} type="button" onClick={() => setAba(item)} className={`-mb-px border-b-2 px-3 py-4 text-sm font-medium transition sm:px-5 ${aba === item ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink"}`}>{item}</button>)}</div>
        <DadosClinicos prontuario={prontuario} aba={aba} />
      </Card>
    </div>
  </>;
}
