"use client";

import { ROTULO_ESPECIE, rotuloAnimal, type Animal, type Grupo } from "@vocare/shared";
import { useState, useTransition } from "react";

import { Button, FormMessage, Input, Modal, ModalFooter } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { corpo } from "./comum";

export function MembroModal({
  orgId,
  grupo,
  animais,
  onClose,
  onDone,
}: {
  orgId: string;
  grupo: Grupo;
  animais: Animal[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const visiveis = animais.filter((a) => !termo || rotuloAnimal(a).toLowerCase().includes(termo));

  function salvar() {
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/grupos/${grupo.id}`, {
        method: "PATCH",
        body: corpo(grupo, [...grupo.animalIds, ...marcados]),
      });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title="Adicionar animais ao grupo" subtitle="Um animal pode estar em mais de um grupo.">
      <div className="flex flex-col gap-3">
        {animais.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Todos os animais ativos já estão neste grupo.</p>
        ) : (
          <>
            <Input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou número"
              aria-label="Buscar animal"
              autoFocus
            />
            <ul className="-mx-2 flex max-h-72 flex-col overflow-y-auto">
              {visiveis.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-field px-2 py-2 text-[15px] hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={marcados.has(a.id)}
                      onChange={() =>
                        setMarcados((s) => {
                          const n = new Set(s);
                          if (n.has(a.id)) n.delete(a.id);
                          else n.add(a.id);
                          return n;
                        })
                      }
                      className="size-[18px] accent-brand"
                    />
                    <span className="flex-1 text-ink">{rotuloAnimal(a)}</span>
                    <span className="text-sm text-ink-muted">{ROTULO_ESPECIE[a.especie]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {erro && <FormMessage>{erro}</FormMessage>}
        <ModalFooter start={<span className="text-sm text-ink-muted">{marcados.size ? `${marcados.size} marcados` : ""}</span>}>
          <Button variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primario" onClick={salvar} loading={pending} disabled={marcados.size === 0}>
            Adicionar
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
