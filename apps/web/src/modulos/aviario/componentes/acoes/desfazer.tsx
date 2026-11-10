"use client";

import { useState, useTransition } from "react";

import { ConfirmBar, FormMessage, Modal } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import type { Base } from "./modal-acao";

export function DesfazerModal({
  orgId,
  loteId,
  onClose,
  onDone,
  rota,
}: Base & { rota: "desfazer-transferencia" | "reabrir" }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const reabrir = rota === "reabrir";

  function confirmar() {
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/lotes/${loteId}/${rota}`, { method: "POST" });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={reabrir ? "Reabrir lote" : "Desfazer última transferência"}
      subtitle={reabrir ? "O lote volta a ativo nos galpões onde estava." : "As aves voltam para o galpão de origem."}
    >
      <div className="flex flex-col gap-4">
        {erro && <FormMessage>{erro}</FormMessage>}
        <ConfirmBar onCancel={onClose} onConfirm={confirmar} confirmLabel={reabrir ? "Reabrir" : "Desfazer"} pending={pending}>
          {reabrir ? "Reabrir o lote e desfazer o encerramento?" : "Desfazer a última transferência deste lote?"}
        </ConfirmBar>
      </div>
    </Modal>
  );
}

/** Encerrar pede data e confirmação na barra de perigo; dá para desfazer com "Reabrir lote". */
