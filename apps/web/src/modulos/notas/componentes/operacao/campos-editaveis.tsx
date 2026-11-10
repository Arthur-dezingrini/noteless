"use client";

import { type CampoCorrigivel, type Operacao } from "@vocare/shared";
import { useState, type KeyboardEvent } from "react";

import { Select } from "@/components/ui";

import { ROTULO_CAMPO, CAMPOS_DATA, CAMPOS_INTEIROS, CAMPOS_DECIMAIS, CAMPOS_ESCOLHA, opcional, ehAviario, formatarCampo, opcoesDe, camposDe } from "./descricao";
import { type Cadastro } from "../tipos";

/**
 * Uma linha por campo, com "Corrigir". Enter confirma, Esc cancela; o valor
 * que a IA tinha proposto continua à vista ("corrigido, era “480 kg”").
 */
export function CamposEditaveis({
  op,
  cad,
  editavel,
  registradoPor,
  onCorrigir,
  onDesfazer,
}: {
  op: Operacao;
  cad: Cadastro;
  editavel: boolean;
  registradoPor: string;
  onCorrigir: (c: CampoCorrigivel, valor: unknown) => void;
  onDesfazer: (c: CampoCorrigivel) => void;
}) {
  const [editando, setEditando] = useState<CampoCorrigivel | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const atual = op as Record<string, unknown>;
  const original = op.original ?? {};

  function abrir(c: CampoCorrigivel) {
    setErro(null);
    setEditando(c);
    setRascunho(atual[c] == null ? "" : String(atual[c]));
  }

  function confirmar(c: CampoCorrigivel, bruto = rascunho) {
    let valor: unknown = bruto.trim();
    if (valor === "") {
      if (!opcional(op.tipo, c)) return setErro("Este campo não pode ficar vazio.");
      valor = null;
    } else if (c === "pesoKg") {
      valor = Number(bruto.replace(",", "."));
      if (!Number.isFinite(valor) || (valor as number) <= 0) return setErro("Informe um peso maior que zero.");
    } else if (CAMPOS_DECIMAIS.includes(c)) {
      valor = Number(bruto.replace(",", "."));
      if (!Number.isFinite(valor) || (valor as number) < 0) return setErro(ehAviario(op) ? "Informe um número válido, como 12,5." : "Informe um número válido.");
      if (c === "pesoMedioG" && valor === 0) return setErro("Informe um peso maior que zero.");
    } else if (CAMPOS_INTEIROS.includes(c)) {
      valor = Number(bruto);
      if (!Number.isInteger(valor) || (valor as number) < 0) return setErro(ehAviario(op) ? "Informe um número inteiro, sem vírgula." : "Informe um número inteiro.");
    }
    onCorrigir(c, valor);
    setEditando(null);
  }

  function teclas(e: KeyboardEvent, c: CampoCorrigivel) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar(c);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditando(null);
    }
  }

  function entrada(c: CampoCorrigivel) {
    const comum = { autoFocus: true, "aria-label": ROTULO_CAMPO[c], onKeyDown: (e: KeyboardEvent) => teclas(e, c) };
    if (CAMPOS_ESCOLHA.includes(c)) {
      return (
        <Select {...comum} value={rascunho} onChange={(e) => confirmar(c, e.target.value)} className="min-w-0 flex-[1_1_10rem]">
          {(c === "animalId" || c === "grupoId" || c === "instalacaoId" || c === "loteId" || (c === "sexo" && opcional(op.tipo, c))) && (
            <option value="">{c === "sexo" ? "Não informado" : "Escolha…"}</option>
          )}
          {opcoesDe(c, cad).map((o) => (
            <option key={o.v} value={o.v}>
              {o.r}
            </option>
          ))}
        </Select>
      );
    }
    return (
      <input
        {...comum}
        type={CAMPOS_DATA.includes(c) ? "date" : c === "hora" ? "time" : "text"}
        inputMode={c === "pesoKg" || CAMPOS_DECIMAIS.includes(c) ? "decimal" : CAMPOS_INTEIROS.includes(c) ? "numeric" : undefined}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        className="h-[34px] min-w-0 flex-[1_1_10rem] rounded-lg border border-brand bg-white px-2.5 text-sm text-ink outline-none"
      />
    );
  }

  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-[18px] gap-y-1.5 rounded-field border border-line-soft bg-detail px-3.5 py-2.5 text-sm">
      {camposDe(op).map((c) => {
        const corrigido = c in original;
        return (
          <div key={c} className="contents">
            <dt className="text-ink-muted">{ROTULO_CAMPO[c]}</dt>
            <dd className="flex min-h-[30px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              {editando === c ? (
                <>
                  {entrada(c)}
                  {!CAMPOS_ESCOLHA.includes(c) && (
                    <button type="button" onClick={() => confirmar(c)} className="h-[34px] cursor-pointer rounded-lg bg-ink px-3 text-[13px] font-semibold text-white">
                      Pronto
                    </button>
                  )}
                  <button type="button" onClick={() => setEditando(null)} className="h-[34px] cursor-pointer rounded-lg px-2 text-[13px] font-semibold text-ink-soft">
                    Cancelar
                  </button>
                  {erro && <span className="basis-full text-[13px] text-danger">{erro}</span>}
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">{formatarCampo(c, atual[c], cad, op.alvo)}</span>
                  {corrigido && (
                    <>
                      <span className="text-[13px] text-brand-ink">corrigido, era “{formatarCampo(c, original[c], cad, op.alvo)}”</span>
                      {editavel && (
                        <button type="button" onClick={() => onDesfazer(c)} className="cursor-pointer text-[13px] font-semibold text-ink-soft underline underline-offset-[3px]">
                          Desfazer
                        </button>
                      )}
                    </>
                  )}
                  {editavel && (
                    <button
                      type="button"
                      onClick={() => abrir(c)}
                      aria-label={`Corrigir ${ROTULO_CAMPO[c].toLowerCase()}`}
                      className="ml-auto cursor-pointer rounded-md px-2 py-1 text-[13px] font-semibold text-ink-soft hover:bg-[#efede8]"
                    >
                      Corrigir
                    </button>
                  )}
                </>
              )}
            </dd>
          </div>
        );
      })}
      <dt className="text-ink-muted">Registrado por</dt>
      <dd className="flex min-h-[30px] items-center font-semibold text-ink">{registradoPor}</dd>
    </dl>
  );
}
