"use client";

import { transferirLoteSchema, type FichaLote, type Instalacao } from "@vocare/shared";
import { useState } from "react";

import { Field, Input, Select } from "@/components/ui";
import { hojeISO } from "@/lib/datas";
import { ModalAcao, inteiro, type Base, primeiroErro } from "./modal-acao";

export function vivasNoGalpao(ficha: FichaLote, instalacaoId: string) {
  const aloj = ficha.alojamentos.find((a) => a.instalacaoId === instalacaoId && a.fim === null);
  if (!aloj) return { femeas: 0, machos: 0 };
  let femeas = aloj.femeas;
  let machos = aloj.machos;
  for (const d of ficha.diario) {
    if (d.instalacaoId !== instalacaoId || d.data < aloj.inicio) continue;
    femeas -= (d.valores.mortasFemeas ?? 0) + (d.valores.eliminadasFemeas ?? 0);
    machos -= (d.valores.mortasMachos ?? 0) + (d.valores.eliminadasMachos ?? 0);
  }
  return { femeas: Math.max(0, femeas), machos: Math.max(0, machos) };
}

export function TransferirModal({ ficha, instalacoes, ...base }: Base & { ficha: FichaLote; instalacoes: Instalacao[] }) {
  const origens = ficha.lote.galpoes;
  const livres = instalacoes.filter((i) => i.ativa && !i.loteAtual);
  const [de, setDe] = useState(origens[0]?.id ?? "");
  const vivas = vivasNoGalpao(ficha, de);
  return (
    <ModalAcao
      {...base}
      rota="transferir"
      titulo="Transferir aves"
      subtitulo="Passa todas as aves do galpão de origem para um galpão livre."
      confirmar="Transferir"
      montar={(f) => {
        const p = transferirLoteSchema.safeParse({
          data: f.get("data"),
          de: f.get("de"),
          para: f.get("para"),
          femeas: inteiro(f.get("femeas")),
          machos: inteiro(f.get("machos")),
        });
        if (!p.success) return primeiroErro(p.error);
        if (p.data.de === p.data.para) return { erro: "Escolha um galpão de destino diferente do de origem." };
        if (p.data.femeas + p.data.machos === 0) return { erro: "Informe quantas aves vão passar." };
        return { corpo: p.data };
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="data" type="date" defaultValue={hojeISO()} />
        </Field>
        <span className="hidden sm:block" />
        <Field label="De">
          <Select name="de" value={de} onChange={(e) => setDe(e.target.value)}>
            {origens.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Para">
          <Select name="para" defaultValue="">
            <option value="">Escolha o galpão</option>
            {livres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fêmeas">
          <Input key={`f-${de}`} name="femeas" inputMode="numeric" defaultValue={String(vivas.femeas)} />
        </Field>
        <Field label="Machos">
          <Input key={`m-${de}`} name="machos" inputMode="numeric" defaultValue={String(vivas.machos)} />
        </Field>
      </div>
      <p className="text-sm text-ink-muted">
        A transferência move todas as aves do galpão e libera o galpão de origem. Confira os números: não podem passar das aves vivas.
      </p>
      {livres.length === 0 && <p className="text-sm text-ink-muted">Não há galpão livre. Cadastre um em Configurações, Galpões.</p>}
    </ModalAcao>
  );
}
