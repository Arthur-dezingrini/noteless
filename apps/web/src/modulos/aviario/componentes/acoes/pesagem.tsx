"use client";

import { pesagemLoteInputSchema, ROTULO_SEXO, type FichaLote } from "@vocare/shared";

import { Field, Input, Select } from "@/components/ui";
import { hojeISO } from "@/lib/datas";

import { numeroPtBr } from "../apontamento-modal";
import { ModalAcao, texto, type Base, primeiroErro } from "./modal-acao";

export function PesagemModal({ ficha, ...base }: Base & { ficha: FichaLote }) {
  return (
    <ModalAcao
      {...base}
      rota="pesagens"
      titulo="Registrar pesagem"
      confirmar="Salvar"
      montar={(f) => {
        const p = pesagemLoteInputSchema.safeParse({
          data: f.get("data"),
          sexo: f.get("sexo"),
          pesoMedioG: numeroPtBr(f.get("pesoMedioG")),
          uniformidadePct: numeroPtBr(f.get("uniformidadePct")),
          amostra: numeroPtBr(f.get("amostra")),
          instalacaoId: texto(f.get("instalacaoId")),
        });
        return p.success ? { corpo: p.data } : primeiroErro(p.error);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="data" type="date" defaultValue={hojeISO()} />
        </Field>
        <Field label="Sexo">
          <Select name="sexo" defaultValue="femea">
            <option value="femea">{ROTULO_SEXO.femea}</option>
            <option value="macho">{ROTULO_SEXO.macho}</option>
          </Select>
        </Field>
        <Field label="Peso médio (g)">
          <Input name="pesoMedioG" inputMode="decimal" autoComplete="off" />
        </Field>
        <Field label="Uniformidade (%)" hint="(opcional)">
          <Input name="uniformidadePct" inputMode="decimal" autoComplete="off" />
        </Field>
        <Field label="Aves pesadas" hint="(opcional)">
          <Input name="amostra" inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Galpão" hint="(opcional)">
          <Select name="instalacaoId" defaultValue="">
            <option value="">Todos</option>
            {ficha.lote.galpoes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </ModalAcao>
  );
}
