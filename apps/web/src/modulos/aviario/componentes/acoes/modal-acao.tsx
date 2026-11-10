"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Button, FormMessage, Modal, ModalFooter } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

import { numeroPtBr } from "../apontamento-modal";

export type Base = { orgId: string; loteId: string; onClose: () => void; onDone: () => void };

export const inteiro = (v: FormDataEntryValue | null) => numeroPtBr(v) ?? 0;
export const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

/** Casca comum: formulário, erro, rodapé e a chamada à api. `montar` devolve o corpo ou a mensagem de erro. */
export function ModalAcao({
  orgId,
  loteId,
  rota,
  titulo,
  subtitulo,
  confirmar,
  montar,
  onClose,
  onDone,
  children,
}: Base & {
  rota: string;
  titulo: string;
  subtitulo?: string;
  confirmar: string;
  montar: (form: FormData) => { corpo: unknown } | { erro: string };
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const r = montar(new FormData(e.currentTarget));
    if ("erro" in r) return setErro(r.erro);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/lotes/${loteId}/${rota}`, { method: "POST", body: JSON.stringify(r.corpo) });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={titulo} subtitle={subtitulo}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {children}
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

export const primeiroErro = (e: { issues: { message: string }[] }) => ({ erro: e.issues[0]?.message ?? "Dados inválidos." });

/** Aves vivas hoje no galpão: o que entrou menos as baixas apontadas desde a entrada. */
