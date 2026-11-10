"use client";

import { FASES_LOTE, faseLoteSchema, ROTULO_FASE_LOTE, type FichaLote } from "@vocare/shared";

import { Field, Select } from "@/components/ui";
import { ModalAcao, type Base, primeiroErro } from "./modal-acao";

export function FaseModal({ ficha, ...base }: Base & { ficha: FichaLote }) {
  return (
    <ModalAcao
      {...base}
      rota="fase"
      titulo="Mudar a fase"
      subtitulo="A fase muda a leitura dos indicadores do lote."
      confirmar="Salvar"
      montar={(f) => {
        const p = faseLoteSchema.safeParse({ fase: f.get("fase") });
        return p.success ? { corpo: p.data } : primeiroErro(p.error);
      }}
    >
      <Field label="Fase">
        <Select name="fase" defaultValue={ficha.lote.fase}>
          {FASES_LOTE.map((f) => (
            <option key={f} value={f}>
              {ROTULO_FASE_LOTE[f]}
            </option>
          ))}
        </Select>
      </Field>
    </ModalAcao>
  );
}

/** Desfazer a última transferência ou reabrir o lote: só confirmação, a api diz se não dá. */
