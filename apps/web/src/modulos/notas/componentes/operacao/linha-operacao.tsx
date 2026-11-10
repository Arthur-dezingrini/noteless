"use client";

import { DESTINO_OPERACAO, temAlvo, type CampoCorrigivel, type Operacao, type StatusOcorrencia } from "@vocare/shared";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";

import { LIMIAR_ATENCAO, ehAviario, nomeAlvo, formatarCampo, camposDe } from "./descricao";
import { type Cadastro } from "../tipos";
import { CamposEditaveis } from "./campos-editaveis";

export function LinhaOperacao({
  op,
  cad,
  estado,
  marcada,
  aberta,
  registradoPor,
  onToggle,
  onAbrir,
  onCorrigir,
  onDesfazer,
  onCadastrarNovo,
}: {
  op: Operacao;
  cad: Cadastro;
  estado: StatusOcorrencia;
  marcada: boolean;
  aberta: boolean;
  registradoPor: string;
  onToggle: () => void;
  onAbrir: () => void;
  onCorrigir: (c: CampoCorrigivel, valor: unknown) => void;
  onDesfazer: (c: CampoCorrigivel) => void;
  onCadastrarNovo: () => void;
}) {
  const editavel = estado === "pendente";
  const salva = estado === "confirmada";
  const bloqueada = editavel && !temAlvo(op);
  const ligada = salva ? op.aplicada !== false : editavel && marcada;
  const d = DESTINO_OPERACAO[op.tipo];
  const atual = op as Record<string, unknown>;
  const corrigidos = Object.keys(op.original ?? {}).length;
  const resumo = camposDe(op)
    .slice(0, 2)
    .map((c) => formatarCampo(c, atual[c], cad, op.alvo))
    .join(" · ");
  const linkHistorico =
    salva && op.aplicada && "animalId" in op && op.animalId && cad.animais.has(op.animalId)
      ? { href: `/animais/${op.animalId}` as const, rotulo: `Ver no histórico${op.tipo === "agendar_consulta" ? " e na agenda" : ""}` }
      : null;

  return (
    <li className={`flex items-start gap-3.5 rounded-field p-3 hover:bg-detail ${estado === "descartada" || (salva && op.aplicada === false) ? "opacity-55" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={ligada}
        aria-label={`${salva ? d.feito : d.acao}: ${nomeAlvo(op, cad)}`}
        disabled={!editavel || bloqueada}
        onClick={onToggle}
        className={`mt-px grid size-[22px] shrink-0 place-items-center rounded-md border-[1.5px] text-white ${
          ligada ? "border-brand bg-brand" : bloqueada ? "border-dashed border-[#d8b0a6] bg-white" : "border-[#c9c5bb] bg-white"
        } ${editavel && !bloqueada ? "cursor-pointer" : "cursor-default"}`}
      >
        {ligada && <Check className="size-3" strokeWidth={3.5} />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button type="button" onClick={onAbrir} aria-expanded={aberta} className="flex cursor-pointer items-start justify-between gap-3 text-left">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-base font-semibold text-ink">{salva && op.aplicada !== false ? d.feito : d.acao}</span>
            <span className="text-sm text-ink-muted">
              {nomeAlvo(op, cad)} → {d.onde}
            </span>
            {!aberta && (
              <span className="truncate text-sm text-ink-soft">
                {resumo}
                {corrigidos > 0 && " · corrigido"}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink-muted">
            {aberta ? "Menos" : "Detalhes"}
            <ChevronDown className={`size-3.5 transition ${aberta ? "rotate-180" : ""}`} />
          </span>
        </button>

        {aberta && (
          <>
            <CamposEditaveis op={op} cad={cad} editavel={editavel} registradoPor={registradoPor} onCorrigir={onCorrigir} onDesfazer={onDesfazer} />
            {op.trecho && <p className="text-sm text-ink-muted">você disse “{op.trecho}”</p>}
          </>
        )}

        {editavel && op.confianca < LIMIAR_ATENCAO && temAlvo(op) && !op.original && (
          <p className="text-sm text-warn">Confira: não temos certeza deste dado.</p>
        )}
        {bloqueada && (
          <p className="flex flex-wrap items-baseline gap-3 text-sm">
            <span className="text-danger">
              {ehAviario(op)
                ? `Não achamos “${op.alvo}” entre os ${op.tipo === "apontar_galpao" ? "galpões" : "lotes"}. Abra os detalhes e escolha ${op.tipo === "apontar_galpao" ? "o galpão" : "o lote"}.`
                : `Não achamos “${op.alvo}” no cadastro.`}
            </span>
            {!ehAviario(op) && (
              <button type="button" onClick={onCadastrarNovo} className="cursor-pointer font-semibold text-ink underline underline-offset-[3px]">
                Cadastrar como animal novo
              </button>
            )}
          </p>
        )}
        {linkHistorico && (
          <Link href={linkHistorico.href} className="self-start text-sm font-semibold no-underline hover:underline">
            {linkHistorico.rotulo}
          </Link>
        )}
      </div>
    </li>
  );
}
