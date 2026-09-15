import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Info,
  MessageCircle,
  Mic,
  Scale,
  Smartphone,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react";

import { Avatar } from "@/components/app/avatar";
import { Badge, type Tone } from "@/components/app/badge";
import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import {
  OCORRENCIAS,
  type Ocorrencia,
  type Operacao,
  type StatusOcorrencia,
  type TipoOperacao,
} from "@/lib/mock/ocorrencias";

export const metadata = { title: "Registros de Ocorrências" };

const ICONE_OPERACAO: Record<TipoOperacao, typeof Syringe> = {
  vacinacao: Syringe,
  observacao: Stethoscope,
  peso: Scale,
  lote: ArrowRightLeft,
};

const STATUS: Record<StatusOcorrencia, { label: string; tone: Tone }> = {
  pendente: { label: "Aguardando revisão", tone: "yellow" },
  aprovada: { label: "Aprovada", tone: "green" },
  rejeitada: { label: "Rejeitada", tone: "red" },
};

function corConfianca(c: number) {
  if (c >= 85) return "text-brand";
  if (c >= 70) return "text-amber-600";
  return "text-red-600";
}

function LinhaOperacao({ op, editavel }: { op: Operacao; editavel: boolean }) {
  const Icon = ICONE_OPERACAO[op.tipo];
  const atencao = op.confianca < 70;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-line px-4 py-3">
      {editavel && (
        <input
          type="checkbox"
          defaultChecked={!atencao}
          aria-label={`Incluir: ${op.titulo} em ${op.alvo}`}
          className="mt-1 size-4 accent-brand"
        />
      )}
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {op.titulo} <span className="text-ink-muted">·</span> {op.alvo}
        </p>
        <p className="text-xs text-ink-muted">{op.detalhe}</p>
        <p className="mt-1 text-xs text-ink-muted/80">
          Trecho: <q className="italic">{op.trecho}</q>
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${corConfianca(op.confianca)}`}>
          {op.confianca}%
        </p>
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

function CartaoOcorrencia({ oc }: { oc: Ocorrencia }) {
  const pendente = oc.status === "pendente";
  const Canal = oc.canal === "WhatsApp" ? MessageCircle : Smartphone;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={oc.operador} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{oc.operador}</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Canal className="size-3.5" /> via {oc.canal} · {oc.recebidoHa} ·{" "}
            <Mic className="size-3.5" /> {oc.duracao}
          </p>
        </div>
        <Badge tone={STATUS[oc.status].tone}>{STATUS[oc.status].label}</Badge>
      </div>

      <blockquote className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-ink">
        &ldquo;{oc.transcricao}&rdquo;
      </blockquote>

      <p className="mt-4 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        A IA sugere
      </p>
      <ul className="mt-2 space-y-2">
        {oc.operacoes.map((op) => (
          <LinhaOperacao key={op.trecho} op={op} editavel={pendente} />
        ))}
      </ul>

      {pendente && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            <Check className="size-4" /> Confirmar selecionadas
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-surface"
          >
            Editar antes
          </button>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-red-50 hover:text-red-700"
          >
            <X className="size-4" /> Rejeitar
          </button>
        </div>
      )}
    </Card>
  );
}

export default function OcorrenciasPage() {
  const pendentes = OCORRENCIAS.filter((o) => o.status === "pendente");
  const aprovadas = OCORRENCIAS.filter((o) => o.status === "aprovada");
  const rejeitadas = OCORRENCIAS.filter((o) => o.status === "rejeitada");

  return (
    <>
      <PageHeader
        title="Registros de Ocorrências"
        subtitle="Áudios enviados do campo, interpretados pela IA. Nada é gravado no sistema sem a sua confirmação."
      />

      {/* Some quando o pipeline de áudio estiver ligado. */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Dados de exemplo.</strong> O pipeline de áudio ainda não está
          ligado; esta tela mostra como as sugestões vão aparecer e o que o
          revisor vai poder fazer.
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-line">
        {[
          { label: "Pendentes", n: pendentes.length, ativo: true },
          { label: "Aprovadas", n: aprovadas.length, ativo: false },
          { label: "Rejeitadas", n: rejeitadas.length, ativo: false },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            aria-current={t.ativo ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              t.ativo
                ? "border-brand text-brand"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label} <span className="ml-1 text-xs tabular-nums opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {[...pendentes, ...aprovadas].map((oc) => (
          <CartaoOcorrencia key={oc.id} oc={oc} />
        ))}
      </div>
    </>
  );
}
