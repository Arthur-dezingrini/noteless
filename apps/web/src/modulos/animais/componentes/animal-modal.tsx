"use client";

import {
  atualizarAnimalSchema,
  criarAnimalSchema,
  ESPECIES,
  ROTULO_ESPECIE,
  ROTULO_SEXO,
  ROTULO_STATUS_ANIMAL,
  SEXOS,
  STATUS_ANIMAL,
  rotuloAnimal,
  type Animal,
} from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, ConfirmBar, Field, FormMessage, Input, Modal, ModalFooter, Select } from "@/components/ui";
import { chamarApi, chamarApiJson } from "@/lib/api-client";

/** Texto do formulário: vazio vira null, como o contrato espera. */
function texto(form: FormData, nome: string): string | null {
  const v = form.get(nome);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Cadastrar e editar animal — a diferença é ter `animal` ou não. "Só o nome
 * ou o número e a espécie são obrigatórios."
 */
export function AnimalModal({
  animal,
  orgId,
  possoRemover,
  inicial,
  onClose,
  onDone,
}: {
  animal: Animal | null;
  orgId: string;
  possoRemover: boolean;
  /** Pré-preenche o cadastro (ex.: o nome que foi dito no áudio). */
  inicial?: { nome?: string; numero?: string };
  onClose: () => void;
  /** `criadoId` vem no cadastro novo; `removido` quando o animal saiu. */
  onDone: (r?: { removido?: boolean; criadoId?: string }) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const dados = {
      numero: texto(form, "numero"),
      nome: texto(form, "nome"),
      especie: form.get("especie"),
      raca: texto(form, "raca"),
      sexo: texto(form, "sexo"),
      nascimento: texto(form, "nascimento"),
      pesoKg: texto(form, "pesoKg")?.replace(",", ".") ?? null,
      local: texto(form, "local"),
      microchip: texto(form, "microchip"),
      tutor: texto(form, "tutor"),
      tutorTelefone: texto(form, "tutorTelefone"),
      // Não tem campo: vem das consultas. Mantém o que já havia.
      ultimaVisita: animal?.ultimaVisita ?? null,
    };
    const parsed = animal
      ? atualizarAnimalSchema.safeParse({ ...dados, status: form.get("status") })
      : criarAnimalSchema.safeParse(dados);
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    start(async () => {
      if (animal) {
        const err = await chamarApi(`/api/org/${orgId}/animais/${animal.id}`, { method: "PATCH", body: JSON.stringify(parsed.data) });
        if (err) return setErro(err);
        return onDone();
      }
      const r = await chamarApiJson<{ id: string }>(`/api/org/${orgId}/animais`, { method: "POST", body: JSON.stringify(parsed.data) });
      if (!r.ok) return setErro(r.error);
      onDone({ criadoId: r.data.id });
    });
  }

  function remover() {
    if (!animal) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/animais/${animal.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      onDone({ removido: true });
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={animal ? "Editar dados" : "Cadastrar animal"}
      subtitle={animal ? rotuloAnimal(animal) : "Só o nome ou o número e a espécie são obrigatórios."}
      wide
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número" hint="(brinco, coleira ou registro)">
            <Input name="numero" defaultValue={animal?.numero ?? inicial?.numero ?? ""} placeholder="Ex.: 132" autoComplete="off" autoFocus />
          </Field>
          <Field label="Nome">
            <Input name="nome" defaultValue={animal?.nome ?? inicial?.nome ?? ""} placeholder="Ex.: Thor" autoComplete="off" />
          </Field>
          <Field label="Espécie">
            <Select name="especie" defaultValue={animal?.especie ?? "cao"}>
              {ESPECIES.map((e) => (
                <option key={e} value={e}>
                  {ROTULO_ESPECIE[e]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Raça">
            <Input name="raca" defaultValue={animal?.raca ?? ""} placeholder="Ex.: Labrador" />
          </Field>
          <Field label="Sexo">
            <Select name="sexo" defaultValue={animal?.sexo ?? ""}>
              <option value="">Não informado</option>
              {SEXOS.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SEXO[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nascimento">
            <Input name="nascimento" type="date" defaultValue={animal?.nascimento ?? ""} />
          </Field>
          <Field label="Peso (kg)">
            <Input name="pesoKg" inputMode="decimal" defaultValue={animal?.pesoKg ?? ""} placeholder="Ex.: 32" />
          </Field>
          <Field label="Onde fica">
            <Input name="local" defaultValue={animal?.local ?? ""} placeholder="Ex.: Casa, Baia 1, Lote 2" />
          </Field>
          <Field label="Microchip" hint="(opcional)">
            <Input name="microchip" defaultValue={animal?.microchip ?? ""} />
          </Field>
          {animal ? (
            <Field label="Situação">
              <Select name="status" defaultValue={animal.status}>
                {STATUS_ANIMAL.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS_ANIMAL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Field label="Tutor" hint="(opcional)">
            <Input name="tutor" defaultValue={animal?.tutor ?? ""} placeholder="Quem é o dono" />
          </Field>
          <Field label="Telefone do tutor" hint="(opcional)">
            <Input name="tutorTelefone" type="tel" defaultValue={animal?.tutorTelefone ?? ""} />
          </Field>
        </div>

        {erro && <FormMessage>{erro}</FormMessage>}

        {confirmarRemocao && animal && (
          <ConfirmBar onCancel={() => setConfirmarRemocao(false)} onConfirm={remover} pending={pending}>
            Remover <strong>{rotuloAnimal(animal)}</strong> e todo o histórico? Não dá para desfazer.
          </ConfirmBar>
        )}

        <ModalFooter
          start={
            animal && possoRemover && !confirmarRemocao ? (
              <Button variant="perigo" onClick={() => setConfirmarRemocao(true)}>
                Remover animal
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
            {animal ? "Salvar" : "Cadastrar animal"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
