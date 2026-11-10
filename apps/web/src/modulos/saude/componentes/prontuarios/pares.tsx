"use client";

import { MEDIDAS_EXAME } from "@vocare/shared";
import { X } from "lucide-react";

import { Button, buttonClass, Input } from "@/components/ui";

export type AnimalOpcao = { id: string; nome: string | null; numero: string | null };
export type Veterinario = { id: string; nome: string };

export const EXEMPLO_MEDIDA: Record<(typeof MEDIDAS_EXAME)[number], string> = {
  FC: "72 bpm",
  FR: "24 mpm",
  Temperatura: "38,6 °C",
  Peso: "480 kg",
  TPC: "2 s",
};

export type Par = { a: string; b: string };

/**
 * Lista de pares editável (remédio + como tomar, exame + resultado, medida
 * extra + valor). Linha vazia é ignorada ao salvar.
 */
export function Pares({
  titulo,
  itens,
  onChange,
  rotuloA,
  rotuloB,
  exemploA,
  exemploB,
  adicionar,
}: {
  titulo: string;
  itens: Par[];
  onChange: (v: Par[]) => void;
  rotuloA: string;
  rotuloB: string;
  exemploA: string;
  exemploB: string;
  adicionar: string;
}) {
  const mudar = (i: number, m: Partial<Par>) => onChange(itens.map((x, j) => (j === i ? { ...x, ...m } : x)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-ink">{titulo}</legend>
      {itens.map((x, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            value={x.a}
            onChange={(e) => mudar(i, { a: e.target.value })}
            aria-label={`${rotuloA} ${i + 1}`}
            placeholder={exemploA}
            className="min-w-0 flex-[1_1_10rem]"
          />
          <Input
            value={x.b}
            onChange={(e) => mudar(i, { b: e.target.value })}
            aria-label={`${rotuloB} ${i + 1}`}
            placeholder={exemploB}
            className="min-w-0 flex-[2_1_14rem]"
          />
          <button
            type="button"
            onClick={() => onChange(itens.filter((_, j) => j !== i))}
            aria-label={`Tirar ${rotuloA.toLowerCase()} ${i + 1}`}
            className={buttonClass("icone")}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <Button variant="link" onClick={() => onChange([...itens, { a: "", b: "" }])} className="w-fit text-sm">
        {adicionar}
      </Button>
    </fieldset>
  );
}

export const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === "string" ? v.trim() : "";
};
export const preenchidos = (l: Par[]) => l.map((x) => ({ a: x.a.trim(), b: x.b.trim() })).filter((x) => x.a);

/**
 * Registrar e corrigir atendimento. Vindo da agenda, já chega com animal,
 * data, tipo e veterinário da consulta.
 */
