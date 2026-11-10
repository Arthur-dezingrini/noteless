"use client";

import { encerrarLoteSchema } from "@vocare/shared";
import { useState, useTransition } from "react";

import { Button, ConfirmBar, Field, FormMessage, Input, Modal, ModalFooter } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { hojeISO } from "@/lib/datas";
import type { Base } from "./modal-acao";

export function EncerrarModal({ orgId, loteId, onClose, onDone }: Base) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [data, setData] = useState(hojeISO());
  const [confirmando, setConfirmando] = useState(false);

  function encerrar() {
    const p = encerrarLoteSchema.safeParse({ data });
    if (!p.success) return setErro(p.error.issues[0]?.message ?? "Data inválida.");
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/lotes/${loteId}/encerrar`, { method: "POST", body: JSON.stringify(p.data) });
      if (err) {
        setConfirmando(false);
        return setErro(err);
      }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title="Encerrar lote" subtitle="Os galpões ficam livres e o lote sai da lista de ativos.">
      <div className="flex flex-col gap-4">
        <Field label="Data do encerramento">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        {erro && <FormMessage>{erro}</FormMessage>}
        {confirmando ? (
          <ConfirmBar onCancel={() => setConfirmando(false)} onConfirm={encerrar} confirmLabel="Encerrar" pending={pending}>
            Encerrar o lote em {data.slice(8, 10)}/{data.slice(5, 7)}?
          </ConfirmBar>
        ) : (
          <ModalFooter>
            <Button variant="fantasma" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="perigoSolido" onClick={() => setConfirmando(true)}>
              Encerrar lote
            </Button>
          </ModalFooter>
        )}
      </div>
    </Modal>
  );
}
