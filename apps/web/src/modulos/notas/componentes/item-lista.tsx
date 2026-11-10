"use client";

import { temAlvo, type Ocorrencia } from "@vocare/shared";

import { duracaoCurta, haQuantoTempo } from "@/lib/datas";

import { LIMIAR_ATENCAO, naoEntendido } from "./operacao/descricao";

export function ItemLista({ oc, ativa, onClick }: { oc: Ocorrencia; ativa: boolean; onClick: () => void }) {
  const falhou = naoEntendido(oc);
  const n = oc.operacoes.length;
  const atencao = oc.operacoes.filter((op) => !temAlvo(op) || op.confianca < LIMIAR_ATENCAO).length;
  let resumo = `${n} ${n === 1 ? "ação" : "ações"} no sistema`;
  let ponto = "bg-[#c9c5bb]";
  let cor = "text-ink-muted";
  if (falhou) {
    resumo = "Não entendemos o áudio";
    ponto = "bg-danger";
    cor = "text-danger";
  } else if (oc.status === "pendente" && atencao) {
    resumo += ` · ${atencao} para conferir`;
    ponto = "bg-warn-dot";
  } else if (oc.status === "confirmada") {
    ponto = "bg-brand";
  }
  if (oc.status === "pendente" && oc.encaminhadaEm) resumo += " · mandada ao administrador";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={ativa ? "true" : undefined}
        className={`flex w-full cursor-pointer flex-col gap-1 rounded-field px-3.5 py-3 text-left transition ${ativa ? "bg-surface" : "hover:bg-hover"}`}
      >
        <span className="flex justify-between gap-2 text-[15px]">
          <span className="truncate font-semibold text-ink">{oc.criadoPorNome}</span>
          <span className="shrink-0 text-ink-muted" suppressHydrationWarning>
            {haQuantoTempo(oc.createdAt)}
          </span>
        </span>
        <span className="truncate text-[15px] text-ink-soft">{falhou ? `Áudio de ${duracaoCurta(oc.duracaoSeg ?? 0)}` : oc.transcricao}</span>
        <span className={`flex items-center gap-1.5 text-sm ${cor}`}>
          <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${ponto}`} />
          {resumo}
        </span>
      </button>
    </li>
  );
}
