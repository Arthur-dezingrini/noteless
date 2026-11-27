"use client";

import { vacinacaoLoteInputSchema } from "@vocare/shared";

import { Field, Input, Select } from "@/components/ui";
import { hojeISO } from "@/lib/datas";
import { ModalAcao, texto, type Base, primeiroErro } from "./modal-acao";
import { numeroPtBr } from "../apontamento-modal";

type Opcao = { id: string; nome: string };
/** Vacinas/medicamentos e locais do estoque; vazio, o modal fica como antes. */
export type InsumosVacina = { vacinas: Opcao[]; locais: Opcao[] };

export function VacinaModal({ insumos, ...base }: Base & { insumos: InsumosVacina }) {
  const comEstoque = insumos.vacinas.length > 0;
  return (
    <ModalAcao
      {...base}
      rota="vacinacoes"
      titulo="Registrar vacina"
      confirmar="Salvar"
      montar={(f) => {
        const produtoId = texto(f.get("produtoId"));
        const vacina = texto(f.get("vacina")) ?? insumos.vacinas.find((v) => v.id === produtoId)?.nome ?? "";
        const p = vacinacaoLoteInputSchema.safeParse({
          data: f.get("data"),
          vacina,
          via: texto(f.get("via")),
          proximaData: texto(f.get("proximaData")),
          produtoId,
          localId: produtoId ? texto(f.get("localId")) : null,
          quantidade: produtoId ? numeroPtBr(f.get("quantidade")) : null,
          loteFabricacao: produtoId ? texto(f.get("loteFabricacao")) : null,
        });
        return p.success ? { corpo: p.data } : primeiroErro(p.error);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="data" type="date" defaultValue={hojeISO()} />
        </Field>
        <Field label="Vacina" hint={comEstoque ? "(vazio: usa o nome do produto)" : undefined}>
          <Input name="vacina" autoComplete="off" autoFocus />
        </Field>
        <Field label="Via" hint="(opcional)">
          <Input name="via" placeholder="Ex.: água, ocular" autoComplete="off" />
        </Field>
        <Field label="Próxima dose" hint="(opcional)">
          <Input name="proximaData" type="date" />
        </Field>
        {comEstoque && (
          <>
            <Field label="Produto do estoque" hint="(opcional; dá baixa)">
              <Select name="produtoId" defaultValue="">
                <option value="">Não dar baixa</option>
                {insumos.vacinas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Local" hint="(vazio: o único com saldo)">
              <Select name="localId" defaultValue="">
                <option value="">Automático</option>
                {insumos.locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Doses" hint="(vazio: as aves vivas do lote)">
              <Input name="quantidade" inputMode="decimal" autoComplete="off" />
            </Field>
            <Field label="Lote de fabricação" hint="(vazio: o que vence primeiro)">
              <Input name="loteFabricacao" autoComplete="off" />
            </Field>
          </>
        )}
      </div>
    </ModalAcao>
  );
}
