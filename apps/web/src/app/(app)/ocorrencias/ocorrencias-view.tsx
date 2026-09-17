"use client";

import {
  ROTULO_STATUS_OCORRENCIA,
  ROTULO_TIPO_CONSULTA,
  ocorrenciaSchema,
  type Ocorrencia,
  type Operacao,
  type StatusOcorrencia,
  type TipoOperacao,
} from "@vocare/shared";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  Loader2,
  Mic,
  Scale,
  Stethoscope,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Avatar } from "@/components/app/avatar";
import { Badge, type Tone } from "@/components/app/badge";
import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { chamarApiJson } from "@/lib/api-client";
import { duracaoCurta, formatar, haQuantoTempo } from "@/lib/datas";

import { GravadorModal } from "./gravador-modal";

const ICONE_OPERACAO: Record<TipoOperacao, typeof Scale> = {
  agendar_consulta: CalendarPlus,
  registrar_anotacao: Stethoscope,
  registrar_peso: Scale,
};

const TOM_STATUS: Record<StatusOcorrencia, Tone> = {
  pendente: "yellow",
  confirmada: "green",
  descartada: "red",
};

const LIMIAR_ATENCAO = 70;

function corConfianca(c: number) {
  if (c >= 85) return "text-brand";
  if (c >= LIMIAR_ATENCAO) return "text-amber-600";
  return "text-red-600";
}

/** O que a operação vai fazer, em uma linha, com os dados que ela carrega. */
function descrever(op: Operacao): string {
  switch (op.tipo) {
    case "agendar_consulta": {
      const quando = op.data ? formatar(op.data, { day: "numeric", month: "short" }) : "data a definir";
      return `${ROTULO_TIPO_CONSULTA[op.tipoConsulta]} · ${quando}${op.hora ? ` às ${op.hora}` : ""} · ${op.detalhe}`;
    }
    case "registrar_peso":
      return `${op.pesoKg.toLocaleString("pt-BR")} kg · ${op.detalhe}`;
    case "registrar_anotacao":
      return op.texto;
  }
}

function LinhaOperacao({
  op,
  editavel,
  marcada,
  onToggle,
}: {
  op: Operacao;
  editavel: boolean;
  marcada: boolean;
  onToggle: () => void;
}) {
  const Icon = ICONE_OPERACAO[op.tipo];
  const semAnimal = op.animalId === null;
  const atencao = op.confianca < LIMIAR_ATENCAO;
  const apagada = !editavel && op.aplicada === false;

  return (
    <li className={`flex items-start gap-3 rounded-lg border border-line px-4 py-3 ${apagada ? "opacity-50" : ""}`}>
      {editavel && (
        <input
          type="checkbox"
          checked={marcada}
          disabled={semAnimal}
          onChange={onToggle}
          aria-label={`Incluir: ${op.titulo} em ${op.alvo}`}
          className="mt-1 size-4 accent-brand disabled:opacity-40"
        />
      )}
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {op.titulo} <span className="text-ink-muted">·</span> {op.alvo}
        </p>
        <p className="text-xs text-ink-muted">{descrever(op)}</p>
        <p className="mt-1 text-xs text-ink-muted/80">
          Trecho: <q className="italic">{op.trecho}</q>
        </p>
        {semAnimal && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="size-3" /> Animal não encontrado no cadastro — cadastre-o e grave de novo.
          </p>
        )}
        {apagada && <p className="mt-1 text-xs text-ink-muted">Não aplicada</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${corConfianca(op.confianca)}`}>{op.confianca}%</p>
        {atencao ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="size-3" /> conferir
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-ink-muted">confiança</p>
        )}
      </div>
    </li>
  );
}

function CartaoOcorrencia({
  oc,
  orgId,
  onAtualizada,
}: {
  oc: Ocorrencia;
  orgId: string;
  onAtualizada: (oc: Ocorrencia) => void;
}) {
  const pendente = oc.status === "pendente";
  // Começa marcado o que a IA tem confiança e conseguiu ligar a um animal.
  const [marcadas, setMarcadas] = useState<Set<number>>(
    () => new Set(oc.operacoes.flatMap((op, i) => (op.animalId && op.confianca >= LIMIAR_ATENCAO ? [i] : []))),
  );
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function agir(acao: "confirmar" | "descartar") {
    setErro(null);
    start(async () => {
      const r = await chamarApiJson<unknown>(`/api/org/${orgId}/ocorrencias/${oc.id}/${acao}`, {
        method: "POST",
        body: JSON.stringify(acao === "confirmar" ? { operacoes: [...marcadas] } : {}),
      });
      if (!r.ok) return setErro(r.error);
      const parsed = ocorrenciaSchema.safeParse(r.data);
      if (parsed.success) onAtualizada(parsed.data);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={oc.criadoPorNome} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{oc.criadoPorNome}</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Mic className="size-3.5" /> gravado no sistema ·{" "}
            <span suppressHydrationWarning>{haQuantoTempo(oc.createdAt)}</span>
            {oc.duracaoSeg != null && <> · {duracaoCurta(oc.duracaoSeg)}</>}
          </p>
        </div>
        <Badge tone={TOM_STATUS[oc.status]}>{ROTULO_STATUS_OCORRENCIA[oc.status]}</Badge>
      </div>

      <blockquote className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-ink">&ldquo;{oc.transcricao}&rdquo;</blockquote>
      <p className="mt-2 text-sm text-ink-muted">{oc.resumo}</p>

      <p className="mt-4 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {pendente ? "A IA sugere" : "Operações"}
      </p>
      {oc.operacoes.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Nenhuma operação identificada neste áudio.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {oc.operacoes.map((op, i) => (
            <LinhaOperacao
              key={i}
              op={op}
              editavel={pendente}
              marcada={marcadas.has(i)}
              onToggle={() =>
                setMarcadas((s) => {
                  const n = new Set(s);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
            />
          ))}
        </ul>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {erro}
        </p>
      )}

      {pendente ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => agir("confirmar")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-70"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {marcadas.size === 0 ? "Fechar sem aplicar" : `Confirmar ${marcadas.size === 1 ? "selecionada" : "selecionadas"}`}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => agir("descartar")}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-red-50 hover:text-red-700 disabled:opacity-70"
          >
            <X className="size-4" /> Descartar
          </button>
        </div>
      ) : (
        oc.revisadoPorNome && (
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
            Revisado por {oc.revisadoPorNome}
            {oc.revisadoEm && (
              <>
                {" "}
                · <span suppressHydrationWarning>{haQuantoTempo(oc.revisadoEm)}</span>
              </>
            )}
          </p>
        )
      )}
    </Card>
  );
}

const ABAS: { status: StatusOcorrencia; label: string }[] = [
  { status: "pendente", label: "Pendentes" },
  { status: "confirmada", label: "Confirmadas" },
  { status: "descartada", label: "Descartadas" },
];

export function OcorrenciasView({ orgId, ocorrencias: iniciais }: { orgId: string; ocorrencias: Ocorrencia[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [aba, setAba] = useState<StatusOcorrencia>("pendente");
  const [gravando, setGravando] = useState(false);

  function substituir(oc: Ocorrencia) {
    setLista((l) => (l.some((x) => x.id === oc.id) ? l.map((x) => (x.id === oc.id ? oc : x)) : [oc, ...l]));
    // Confirmar pode ter criado consulta/anotação: as outras telas precisam ver.
    router.refresh();
  }

  const visiveis = lista.filter((o) => o.status === aba);

  return (
    <>
      <PageHeader
        title="Registros de Ocorrências"
        subtitle="Áudios do campo, interpretados pela IA. Nada é gravado no sistema sem a sua confirmação."
        aside={
          <button
            type="button"
            onClick={() => setGravando(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            <Mic className="size-4" /> Gravar ocorrência
          </button>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-line">
        {ABAS.map((t) => {
          const n = lista.filter((o) => o.status === t.status).length;
          const ativo = t.status === aba;
          return (
            <button
              key={t.status}
              type="button"
              aria-current={ativo ? "page" : undefined}
              onClick={() => setAba(t.status)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                ativo ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label} <span className="ml-1 text-xs tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <Card className="p-10 text-center">
          <Mic className="mx-auto size-8 text-ink-muted/50" />
          <p className="mt-3 text-sm font-medium text-ink">
            {aba === "pendente" ? "Nenhuma ocorrência aguardando revisão." : "Nada aqui ainda."}
          </p>
          {aba === "pendente" && (
            <p className="mt-1 text-sm text-ink-muted">Grave um áudio para ver a IA propor o que registrar.</p>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {visiveis.map((oc) => (
            <CartaoOcorrencia key={oc.id} oc={oc} orgId={orgId} onAtualizada={substituir} />
          ))}
        </div>
      )}

      {gravando && (
        <GravadorModal
          open
          orgId={orgId}
          onClose={() => setGravando(false)}
          onCriada={(oc) => {
            substituir(oc);
            setAba("pendente");
            setGravando(false);
          }}
        />
      )}
    </>
  );
}
