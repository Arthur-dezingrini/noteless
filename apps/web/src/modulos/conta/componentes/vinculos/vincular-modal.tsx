"use client";

import { criarVinculoSchema, PAPEIS, ROTULO_PAPEL, type Empresa, type UsuarioAdmin } from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Modal, ModalFooter, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

/** Liga a pessoa a uma empresa em que ela ainda não está. */
export function VincularModal({
  usuario,
  empresas,
  onClose,
  onDone,
}: {
  usuario: UsuarioAdmin | null;
  empresas: Empresa[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const livres = empresas.filter((e) => !usuario?.vinculos.some((v) => v.organizationId === e.id));

  function enviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!usuario) return;
    const form = new FormData(ev.currentTarget);
    const parsed = criarVinculoSchema.safeParse({ userId: usuario.id, organizationId: form.get("empresa"), papel: form.get("papel") });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    start(async () => {
      const e = await chamarApi("/api/admin/vinculos", { method: "POST", body: JSON.stringify(parsed.data) });
      if (e) return setErro(e);
      setErro(null);
      onDone();
    });
  }

  return (
    <Modal open={usuario !== null} onClose={onClose} title="Vincular a uma empresa" subtitle={usuario?.nome}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {livres.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Essa pessoa já está em todas as empresas.</p>
        ) : (
          <>
            <Field label="Empresa">
              <Select name="empresa" defaultValue={livres[0]?.id}>
                {livres.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Papel">
              <Select name="papel" defaultValue="member">
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PAPEL[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <FormMessage tone="perigo">{erro}</FormMessage>
        <ModalFooter>
          <Button type="button" variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primario" loading={pending} disabled={livres.length === 0}>
            Vincular
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
