"use client";

import { vincularUsuarioSchema } from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Input, Modal, Select } from "@/components/ui";
import { chamarApiJson } from "@/lib/api-client";
import { BRAND_NAME } from "@/lib/brand";

export function VincularModal({
  open,
  orgId,
  onClose,
  onDone,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onDone: (nome: string) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const parsed = vincularUsuarioSchema.safeParse({
      email: form.get("email"),
      role: form.get("role"),
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    const formEl = e.currentTarget;
    start(async () => {
      const r = await chamarApiJson<{ id: string; name: string }>(`/api/org/${orgId}/usuarios/vincular`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!r.ok) return setErro(r.error);
      formEl.reset();
      onDone(r.data.name);
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Vincular conta existente" subtitle="Para quem já usa o sistema em outra conta.">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          Para quem já tem conta no {BRAND_NAME} por outra clínica ou fazenda. A pessoa passa a ver esta organização no seletor; nome e
          senha não mudam.
        </p>
        <Field label="E-mail da conta">
          <Input name="email" type="email" required autoComplete="off" placeholder="pessoa@exemplo.com" />
        </Field>
        <Field label="Papel nesta organização">
          <Select name="role" defaultValue="member">
            <option value="member">Membro — opera o sistema</option>
            <option value="admin">Administrador — gerencia usuários e dados</option>
          </Select>
        </Field>
        {erro && <FormMessage>{erro}</FormMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primario" loading={pending}>
            Vincular
          </Button>
        </div>
      </form>
    </Modal>
  );
}
