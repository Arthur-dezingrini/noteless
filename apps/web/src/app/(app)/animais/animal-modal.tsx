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
import { Loader2 } from "lucide-react";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Modal } from "@/components/app/modal";
import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { chamarApi } from "@/lib/api-client";

function Campo({ label, dica, children, largo }: { label: string; dica?: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${largo ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-semibold text-ink">
        {label}
        {dica && <span className="font-normal text-ink-muted"> {dica}</span>}
      </span>
      {children}
    </label>
  );
}

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
  onClose,
  onDone,
}: {
  animal: Animal | null;
  orgId: string;
  possoRemover: boolean;
  onClose: () => void;
  onDone: (removido?: boolean) => void;
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
      const err = await chamarApi(animal ? `/api/org/${orgId}/animais/${animal.id}` : `/api/org/${orgId}/animais`, {
        method: animal ? "PATCH" : "POST",
        body: JSON.stringify(parsed.data),
      });
      if (err) return setErro(err);
      onDone();
    });
  }

  function remover() {
    if (!animal) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/animais/${animal.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      onDone(true);
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
          <Campo label="Número" dica="(brinco, coleira ou registro)">
            <input name="numero" className={campo} defaultValue={animal?.numero ?? ""} placeholder="Ex.: 132" autoComplete="off" autoFocus />
          </Campo>
          <Campo label="Nome">
            <input name="nome" className={campo} defaultValue={animal?.nome ?? ""} placeholder="Ex.: Thor" autoComplete="off" />
          </Campo>
          <Campo label="Espécie">
            <Select name="especie" defaultValue={animal?.especie ?? "cao"}>
              {ESPECIES.map((e) => (
                <option key={e} value={e}>
                  {ROTULO_ESPECIE[e]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Raça">
            <input name="raca" className={campo} defaultValue={animal?.raca ?? ""} placeholder="Ex.: Labrador" />
          </Campo>
          <Campo label="Sexo">
            <Select name="sexo" defaultValue={animal?.sexo ?? ""}>
              <option value="">Não informado</option>
              {SEXOS.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SEXO[s]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Nascimento">
            <input name="nascimento" type="date" className={campo} defaultValue={animal?.nascimento ?? ""} />
          </Campo>
          <Campo label="Peso (kg)">
            <input name="pesoKg" inputMode="decimal" className={campo} defaultValue={animal?.pesoKg ?? ""} placeholder="Ex.: 32" />
          </Campo>
          <Campo label="Onde fica">
            <input name="local" className={campo} defaultValue={animal?.local ?? ""} placeholder="Ex.: Casa, Baia 1, Lote 2" />
          </Campo>
          <Campo label="Microchip" dica="(opcional)">
            <input name="microchip" className={campo} defaultValue={animal?.microchip ?? ""} />
          </Campo>
          {animal ? (
            <Campo label="Situação">
              <Select name="status" defaultValue={animal.status}>
                {STATUS_ANIMAL.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS_ANIMAL[s]}
                  </option>
                ))}
              </Select>
            </Campo>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Campo label="Tutor" dica="(opcional)">
            <input name="tutor" className={campo} defaultValue={animal?.tutor ?? ""} placeholder="Quem é o dono" />
          </Campo>
          <Campo label="Telefone do tutor" dica="(opcional)">
            <input name="tutorTelefone" type="tel" className={campo} defaultValue={animal?.tutorTelefone ?? ""} />
          </Campo>
        </div>

        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}

        {confirmarRemocao && animal && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-[#efd3cc] bg-danger-bg px-4 py-3 text-[15px] text-ink">
            <span>
              Remover <strong>{rotuloAnimal(animal)}</strong> e todo o histórico? Não dá para desfazer.
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirmarRemocao(false)} className={btn.secundario}>
                Não
              </button>
              <button type="button" onClick={remover} disabled={pending} className={btn.perigoSolido}>
                Remover
              </button>
            </span>
          </div>
        )}

        <div className="-mx-6 -mb-6 flex items-center justify-between gap-2 border-t border-line px-6 py-4">
          {animal && possoRemover && !confirmarRemocao ? (
            <button type="button" onClick={() => setConfirmarRemocao(true)} className={btn.perigo}>
              Remover animal
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-field px-3.5 text-[15px] font-semibold text-ink hover:bg-hover">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btn.primario}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {animal ? "Salvar" : "Cadastrar animal"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
