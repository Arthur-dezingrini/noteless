"use client";

import { rotuloAnimal, type Animal } from "@vocare/shared";
import { useState } from "react";

import { Field, Input, Select } from "@/components/ui";

/** Valor do select do pai quando ele não é do rebanho: o nome vai em texto. */
export const PAI_DE_FORA = "de-fora";

/**
 * Mãe e pai, do cadastro. O pai pode ser de fora do rebanho (sêmen
 * comprado, reprodutor do vizinho): aí vira texto.
 */
export function CamposPais({ animal, animais }: { animal: Animal | null; animais: Animal[] }) {
  const [paiDeFora, setPaiDeFora] = useState(!!animal?.paiExterno);
  const outros = animais.filter((a) => a.id !== animal?.id);
  // Quem já está escolhido continua na lista, mesmo com o sexo trocado depois.
  const maes = outros.filter((a) => a.sexo !== "macho" || a.id === animal?.maeId);
  const pais = outros.filter((a) => a.sexo !== "femea" || a.id === animal?.paiId);
  const opcao = (a: Animal) => (
    <option key={a.id} value={a.id}>
      {rotuloAnimal(a)}
    </option>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Mãe">
        <Select name="maeId" defaultValue={animal?.maeId ?? ""}>
          <option value="">Não informada</option>
          {maes.map(opcao)}
        </Select>
      </Field>
      <Field label="Pai">
        <Select
          name="paiId"
          defaultValue={animal?.paiExterno ? PAI_DE_FORA : (animal?.paiId ?? "")}
          onChange={(e) => setPaiDeFora(e.target.value === PAI_DE_FORA)}
        >
          <option value="">Não informado</option>
          {pais.map(opcao)}
          <option value={PAI_DE_FORA}>De fora do rebanho…</option>
        </Select>
      </Field>
      {paiDeFora && (
        <Field label="Pai de fora" hint="(sêmen, reprodutor de outro lugar)">
          <Input name="paiExterno" defaultValue={animal?.paiExterno ?? ""} placeholder="Ex.: sêmen Duroc da central" autoFocus />
        </Field>
      )}
    </div>
  );
}
