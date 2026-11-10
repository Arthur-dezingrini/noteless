"use client";

import {
  CAMPOS_APONTAMENTO,
  ROTULO_CAMPO_APONTAMENTO,
  valoresApontamentoSchema,
  type CampoApontamento,
  type DiaGalpao,
} from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Input, Modal, ModalFooter, Select, Textarea } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

const DECIMAIS: CampoApontamento[] = ["racaoKg", "aguaL"];

/** "12,5" ou "12.5" → 12.5; vazio → null; texto inválido → NaN (o schema recusa). */
export function numeroPtBr(v: FormDataEntryValue | null): number | null {
  const t = String(v ?? "").trim().replace(",", ".");
  return t === "" ? null : Number(t);
}

const mostrar = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

/** Lança (ou corrige) o apontamento de um galpão num dia; o PUT substitui o dia inteiro. */
export function ApontamentoModal({
  orgId,
  loteId,
  galpoes,
  dia,
  dataPadrao,
  onClose,
  onDone,
}: {
  orgId: string;
  loteId: string;
  galpoes: { id: string; nome: string }[];
  /** Linha clicada; sem ela, é um lançamento novo (galpão e data editáveis). */
  dia: DiaGalpao | null;
  dataPadrao: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const instalacaoId = dia?.instalacaoId ?? String(form.get("instalacaoId") ?? "");
    const data = dia?.data ?? String(form.get("data") ?? "");
    if (!instalacaoId) return setErro("Escolha o galpão.");
    if (!data) return setErro("Informe a data.");

    const observacoes = String(form.get("observacoes") ?? "").trim();
    const parsed = valoresApontamentoSchema.safeParse({
      ...Object.fromEntries(CAMPOS_APONTAMENTO.map((c) => [c, numeroPtBr(form.get(c))])),
      observacoes: observacoes || null,
    });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    start(async () => {
      const err = await chamarApi(
        `/api/org/${orgId}/lotes/${loteId}/apontamentos/${encodeURIComponent(instalacaoId)}/${data}`,
        { method: "PUT", body: JSON.stringify(parsed.data) },
      );
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={dia ? `Apontamento de ${dia.data.slice(8, 10)}/${dia.data.slice(5, 7)}` : "Lançar apontamento"}
      subtitle={dia ? `${dia.instalacaoNome}. Salvar substitui os números do dia.` : "Informe só o que foi contado; o que ficar em branco não entra."}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!dia && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Galpão">
              <Select name="instalacaoId" defaultValue={galpoes.length === 1 ? galpoes[0]!.id : ""}>
                <option value="">Escolha o galpão</option>
                {galpoes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data">
              <Input name="data" type="date" defaultValue={dataPadrao} />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_APONTAMENTO.map((c) => (
            <Field key={c} label={ROTULO_CAMPO_APONTAMENTO[c]}>
              <Input
                name={c}
                inputMode={DECIMAIS.includes(c) ? "decimal" : "numeric"}
                autoComplete="off"
                defaultValue={mostrar(dia?.valores[c])}
              />
            </Field>
          ))}
          <Field label="Observações" hint="(opcional)" wide>
            <Textarea name="observacoes" rows={2} defaultValue={dia?.valores.observacoes ?? ""} />
          </Field>
        </div>

        {erro && <FormMessage>{erro}</FormMessage>}

        <ModalFooter>
          <Button variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primario" loading={pending}>
            Salvar
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
