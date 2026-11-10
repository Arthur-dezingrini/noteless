"use client";

import { ESPECIES, ROTULO_ESPECIE, type Grupo } from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, ConfirmBar, Field, FormMessage, Input, Modal, ModalFooter, Select } from "@/components/ui";
import { chamarApi, chamarApiJson } from "@/lib/api-client";
import { corpo, MISTURADO } from "./comum";

export function GrupoModal({
  orgId,
  grupo,
  possoRemover,
  onClose,
  onDone,
}: {
  orgId: string;
  grupo: Grupo | null;
  possoRemover: boolean;
  onClose: () => void;
  onDone: (id?: string) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const dados = {
      nome: String(f.get("nome") ?? "").trim(),
      descricao: grupo?.descricao ?? null,
      especie: String(f.get("especie") || "") || null,
      local: String(f.get("local") ?? "").trim() || null,
    };
    if (dados.nome.length < 2) return setErro("Informe o nome do grupo.");
    setErro(null);
    start(async () => {
      const r = await chamarApiJson<{ id: string }>(grupo ? `/api/org/${orgId}/grupos/${grupo.id}` : `/api/org/${orgId}/grupos`, {
        method: grupo ? "PATCH" : "POST",
        body: corpo(dados, grupo?.animalIds ?? []),
      });
      if (!r.ok) return setErro(r.error);
      onDone(r.data.id);
    });
  }

  function remover() {
    if (!grupo) return;
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/grupos/${grupo.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={grupo ? "Editar grupo" : "Criar grupo"}
      subtitle={grupo ? "O nome é o que se fala no microfone." : "Depois é só falar o nome do grupo no microfone."}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do grupo" wide>
            <Input name="nome" defaultValue={grupo?.nome ?? ""} placeholder="Ex.: Lote 5, Bezerros, Cães da casa" autoFocus required />
          </Field>
          <Field label="Espécie">
            <Select name="especie" defaultValue={grupo?.especie ?? ""}>
              <option value="">Não informada</option>
              {ESPECIES.map((e) => (
                <option key={e} value={e}>
                  {ROTULO_ESPECIE[e]}
                </option>
              ))}
              <option value={MISTURADO}>Misturado</option>
            </Select>
          </Field>
          <Field label="Onde fica">
            <Input name="local" defaultValue={grupo?.local ?? ""} placeholder="Ex.: Pasto de cima" />
          </Field>
        </div>
        {erro && <FormMessage>{erro}</FormMessage>}
        {confirmar && grupo && (
          <ConfirmBar onCancel={() => setConfirmar(false)} onConfirm={remover} pending={pending}>
            Remover o grupo {grupo.nome}? Os animais continuam cadastrados.
          </ConfirmBar>
        )}
        <ModalFooter
          start={
            grupo && possoRemover && !confirmar ? (
              <Button variant="perigo" onClick={() => setConfirmar(true)}>
                Remover grupo
              </Button>
            ) : (
              <span />
            )
          }
        >
          <Button variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primario" loading={pending}>
            {grupo ? "Salvar" : "Criar grupo"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

/** "Adicionar animais": marca quantos quiser de uma vez. */
