"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Input, Modal, ModalFooter, Select } from "@/components/ui";

import { lerNumero } from "./comum";

export type Valor = string | number | boolean | null;

export type Campo =
  | { nome: string; rotulo: string; tipo: "texto" | "numero" | "data"; padrao?: string | number | null; dica?: string; obrigatorio?: boolean }
  | { nome: string; rotulo: string; tipo: "opcoes"; opcoes: { valor: string; rotulo: string }[]; padrao?: string | null; dica?: string; vazio?: string }
  | { nome: string; rotulo: string; tipo: "marcar"; padrao?: boolean };

/**
 * Formulário em modal montado a partir de uma lista de campos. `salvar`
 * recebe os valores já lidos (número, texto ou null) e devolve o erro ou null.
 */
export function FormModal({
  titulo,
  subtitulo,
  campos,
  confirmar,
  salvar,
  onClose,
  onDone,
}: {
  titulo: string;
  subtitulo?: string;
  campos: Campo[];
  confirmar: string;
  salvar: (valores: Record<string, Valor>) => Promise<string | null>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const valores: Record<string, Valor> = {};
    for (const c of campos) {
      if (c.tipo === "marcar") valores[c.nome] = form.get(c.nome) === "on";
      else if (c.tipo === "numero") {
        const n = lerNumero(form.get(c.nome));
        if (Number.isNaN(n)) return setErro(`Número inválido em "${c.rotulo}".`);
        valores[c.nome] = n;
      } else valores[c.nome] = String(form.get(c.nome) ?? "").trim() || null;
      if ("obrigatorio" in c && c.obrigatorio && valores[c.nome] == null) return setErro(`Preencha "${c.rotulo}".`);
    }
    start(async () => {
      const r = await salvar(valores);
      if (r) return setErro(r);
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={titulo} subtitle={subtitulo}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {campos.map((c) =>
          c.tipo === "marcar" ? (
            <label key={c.nome} className="flex items-center gap-2 text-[15px] text-ink">
              <input type="checkbox" name={c.nome} defaultChecked={c.padrao} className="size-4" />
              {c.rotulo}
            </label>
          ) : (
            <Field key={c.nome} label={c.rotulo} hint={c.dica}>
              {c.tipo === "opcoes" ? (
                <Select name={c.nome} defaultValue={c.padrao ?? ""}>
                  {c.vazio !== undefined && <option value="">{c.vazio}</option>}
                  {c.opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  name={c.nome}
                  type={c.tipo === "data" ? "date" : "text"}
                  inputMode={c.tipo === "numero" ? "decimal" : undefined}
                  defaultValue={c.padrao == null ? "" : String(c.padrao).replace(".", c.tipo === "numero" ? "," : ".")}
                />
              )}
            </Field>
          ),
        )}
        {erro && <FormMessage>{erro}</FormMessage>}
        <ModalFooter>
          <Button variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primario" loading={pending}>
            {confirmar}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
