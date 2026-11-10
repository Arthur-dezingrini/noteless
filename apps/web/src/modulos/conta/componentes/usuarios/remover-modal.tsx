"use client";

import { type Usuario } from "@vocare/shared";
import { useState, useTransition } from "react";

import { Button, FormMessage, Modal } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

export function RemoverModal({
  usuario,
  orgId,
  onClose,
  onDone,
}: {
  usuario: Usuario | null;
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function remover() {
    if (!usuario) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/usuarios/${usuario.id}`, {
        method: "DELETE",
      });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open={usuario !== null} onClose={onClose} title="Remover usuário">
      {usuario && (
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Tem certeza que deseja remover <strong>{usuario.name}</strong> da organização?
          </p>
          <p className="text-xs text-ink-muted">A conta não será apagada e poderá continuar pertencendo a outras organizações.</p>
          {erro && <FormMessage>{erro}</FormMessage>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="perigoSolido" onClick={remover} loading={pending}>
              Remover
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
