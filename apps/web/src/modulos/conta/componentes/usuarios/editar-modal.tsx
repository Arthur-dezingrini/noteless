"use client";

import { atualizarUsuarioSchema, type Usuario } from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Input, Modal, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

export function EditarModal({
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
  const ehDono = usuario?.role === "owner";

  function fechar() {
    setErro(null);
    onClose();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!usuario) return;
    setErro(null);
    const form = new FormData(e.currentTarget);
    const parsed = atualizarUsuarioSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      cargo: form.get("cargo") ?? "",
      ...(!ehDono && { role: form.get("role") }),
      password: form.get("password") || undefined,
      confirmPassword: form.get("confirmPassword") || undefined,
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/usuarios/${usuario.id}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open={usuario !== null} onClose={fechar} title="Editar usuário">
      {usuario && (
        <form key={usuario.id} onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <Input name="name" defaultValue={usuario.name} required />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" defaultValue={usuario.email} required autoComplete="off" />
          </Field>
          <Field label="Nova senha (opcional)">
            <Input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Deixe em branco para manter" />
          </Field>
          <Field label="Confirmação da nova senha">
            <Input name="confirmPassword" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Cargo">
            <Input name="cargo" defaultValue={usuario.cargo ?? ""} placeholder="Veterinária, Recepcionista, Peão…" />
          </Field>
          <Field label="Papel">
            {ehDono ? (
              <Input className="bg-surface text-ink-muted" value="Dono da organização" disabled />
            ) : (
              <Select name="role" defaultValue={usuario.role}>
                <option value="member">Membro — opera o sistema</option>
                <option value="admin">Administrador — gerencia usuários e dados</option>
              </Select>
            )}
          </Field>

          {erro && <FormMessage>{erro}</FormMessage>}

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={fechar}>Cancelar</Button>
            <Button type="submit" variant="primario" loading={pending}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
