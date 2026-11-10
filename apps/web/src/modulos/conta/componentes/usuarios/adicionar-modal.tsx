"use client";

import { criarUsuarioSchema } from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { Button, Field, FormMessage, Input, Modal, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

export function AdicionarModal({ open, orgId, onClose, onDone }: { open: boolean; orgId: string; onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const parsed = criarUsuarioSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      cargo: form.get("cargo") || undefined,
      role: form.get("role"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
    if (!parsed.success) {
      setErro(z.flattenError(parsed.error).formErrors[0] ?? parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    const formEl = e.currentTarget;
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/usuarios`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (err) return setErro(err);
      formEl.reset();
      onDone();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Cadastrar usuário" subtitle="A pessoa entra com o e-mail e a senha provisória.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome">
          <Input name="name" required autoComplete="off" />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Cargo">
          <Input name="cargo" placeholder="Veterinária, Recepcionista, Peão…" />
        </Field>
        <Field label="Papel">
          <Select name="role" defaultValue="member">
            <option value="member">Membro — opera o sistema</option>
            <option value="admin">Administrador — gerencia usuários e dados</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="active" disabled>
            <option value="active">Ativo</option>
          </Select>
        </Field>
        <Field label="Senha">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
        </Field>
        <Field label="Confirmação de senha">
          <Input name="confirmPassword" type="password" required autoComplete="new-password" />
        </Field>
        <p className="text-xs text-ink-muted">
          Ainda não enviamos e-mail: repasse a senha à pessoa e peça para trocar no primeiro acesso. Se a pessoa já tem conta em outra
          organização, use &ldquo;Vincular usuário&rdquo;.
        </p>
        {erro && <FormMessage>{erro}</FormMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primario" loading={pending}>
            Cadastrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
