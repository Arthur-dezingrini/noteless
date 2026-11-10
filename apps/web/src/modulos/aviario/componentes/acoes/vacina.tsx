"use client";

import { vacinacaoLoteInputSchema } from "@vocare/shared";

import { Field, Input } from "@/components/ui";
import { hojeISO } from "@/lib/datas";
import { ModalAcao, texto, type Base, primeiroErro } from "./modal-acao";

export function VacinaModal(base: Base) {
  return (
    <ModalAcao
      {...base}
      rota="vacinacoes"
      titulo="Registrar vacina"
      confirmar="Salvar"
      montar={(f) => {
        const p = vacinacaoLoteInputSchema.safeParse({
          data: f.get("data"),
          vacina: f.get("vacina"),
          via: texto(f.get("via")),
          proximaData: texto(f.get("proximaData")),
        });
        return p.success ? { corpo: p.data } : primeiroErro(p.error);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="data" type="date" defaultValue={hojeISO()} />
        </Field>
        <Field label="Vacina">
          <Input name="vacina" autoComplete="off" autoFocus />
        </Field>
        <Field label="Via" hint="(opcional)">
          <Input name="via" placeholder="Ex.: água, ocular" autoComplete="off" />
        </Field>
        <Field label="Próxima dose" hint="(opcional)">
          <Input name="proximaData" type="date" />
        </Field>
      </div>
    </ModalAcao>
  );
}
