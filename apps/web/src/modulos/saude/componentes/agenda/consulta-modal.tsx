"use client";

import { ROTULO_TIPO_CONSULTA, TIPOS_CONSULTA, atualizarConsultaSchema, criarConsultaSchema, rotuloAnimal, type Animal } from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Input, Modal, ModalFooter, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { DURACOES, duracao, type Dialogo, type Veterinario } from "./util";

export function ConsultaModal({
  dialogo,
  orgId,
  animais,
  veterinarios,
  onClose,
  onDone,
}: {
  dialogo: NonNullable<Dialogo>;
  orgId: string;
  animais: Animal[];
  veterinarios: Veterinario[];
  onClose: () => void;
  onDone: (data?: string) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const consulta = dialogo.tipo === "remarcar" ? dialogo.consulta : null;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const f = new FormData(e.currentTarget);
    const bruto = {
      animalId: consulta && !consulta.animalId ? null : f.get("animalId"),
      grupoId: consulta?.grupoId ?? null,
      veterinarioId: f.get("veterinarioId") || null,
      data: f.get("data"),
      hora: f.get("hora"),
      duracaoMin: f.get("duracaoMin"),
      tipo: f.get("tipo"),
      observacoes: f.get("observacoes") || null,
      ...(consulta && {
        status: consulta.status === "cancelada" ? "agendada" : consulta.status,
      }),
    };
    const parsed = consulta ? atualizarConsultaSchema.safeParse(bruto) : criarConsultaSchema.safeParse(bruto);
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    start(async () => {
      const err = consulta
        ? await chamarApi(`/api/org/${orgId}/consultas/${consulta.id}`, {
            method: "PATCH",
            body: JSON.stringify(parsed.data),
          })
        : await chamarApi(`/api/org/${orgId}/consultas`, {
            method: "POST",
            body: JSON.stringify(parsed.data),
          });
      if (err) return setErro(err);
      onDone(parsed.data.data);
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={consulta ? "Remarcar consulta" : "Nova consulta"}
      subtitle={consulta ? "Muda o dia, a hora ou quem vai atender." : "Aparece na agenda de quem for atender."}
      wide
    >
      {animais.length === 0 && !consulta ? (
        <p className="text-[15px] text-ink-muted">Cadastre um animal antes de marcar — a consulta precisa estar ligada a um.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {consulta && !consulta.animalId ? (
              <Field label="Grupo" wide>
                <Input value={consulta.animalNome} disabled />
              </Field>
            ) : (
              <Field label="Animal" wide>
                <Select
                  name="animalId"
                  required
                  defaultValue={consulta?.animalId ?? (dialogo.tipo === "nova" ? dialogo.animalId : undefined) ?? ""}
                >
                  <option value="" disabled>
                    Escolha o animal
                  </option>
                  {animais.map((a) => (
                    <option key={a.id} value={a.id}>
                      {rotuloAnimal(a)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Data">
              <Input name="data" type="date" required defaultValue={consulta?.data ?? (dialogo.tipo === "nova" ? dialogo.data : "")} />
            </Field>
            <Field label="Hora">
              <Input name="hora" type="time" required defaultValue={consulta?.hora ?? "10:00"} />
            </Field>
            <Field label="Tipo">
              <Select
                name="tipo"
                defaultValue={consulta?.tipo ?? (dialogo.tipo === "nova" ? dialogo.tipoConsulta : undefined) ?? "consulta"}
              >
                {TIPOS_CONSULTA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_CONSULTA[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duração">
              <Select name="duracaoMin" defaultValue={String(consulta?.duracaoMin ?? 30)}>
                {[...new Set([...DURACOES, consulta?.duracaoMin ?? 30])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {duracao(m)}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Quem vai atender" wide>
              <Select name="veterinarioId" defaultValue={consulta?.veterinarioId ?? ""}>
                <option value="">Ninguém definido</option>
                {veterinarios.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observações" hint="(opcional)" wide>
              <Input
                name="observacoes"
                placeholder="Algo que quem vai atender precisa saber"
                defaultValue={consulta?.observacoes ?? (dialogo.tipo === "nova" ? dialogo.observacoes : undefined) ?? ""}
              />
            </Field>
          </div>

          {erro && <FormMessage>{erro}</FormMessage>}

          <ModalFooter>
            <Button variant="fantasma" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primario" loading={pending}>
              {consulta ? "Salvar" : "Marcar consulta"}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
