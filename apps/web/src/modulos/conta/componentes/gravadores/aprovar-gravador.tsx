"use client";

import { aprovarGravadorSchema, type Empresa, type Gravador } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

/**
 * A placa nova só manda notas depois de aprovada: o código que ela mostra na
 * página de Wi-Fi prova que quem aprova está com ela na mão.
 */
export function AprovarGravador({ g, empresas }: { g: Gravador; empresas: Empresa[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function aprovar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const dados = new FormData(ev.currentTarget);
    const parsed = aprovarGravadorSchema.safeParse({
      codigo: dados.get("codigo"),
      organizationId: dados.get("empresa"),
      nome: dados.get("nome"),
    });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    start(async () => {
      const e = await chamarApi(`/api/admin/gravadores/${g.id}/aprovar`, { method: "POST", body: JSON.stringify(parsed.data) });
      setErro(e);
      if (!e) router.refresh();
    });
  }

  return (
    <form onSubmit={aprovar} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="text-[15px] font-semibold text-ink">Aprovar</h3>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Código" className="w-36">
          <Input name="codigo" placeholder="K7F-3QX" autoComplete="off" spellCheck={false} maxLength={12} className="font-mono uppercase" />
        </Field>
        <Field label="Empresa que recebe as notas" className="min-w-48 flex-1">
          <Select name="empresa" defaultValue="">
            <option value="">Escolha…</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nome" className="min-w-40 flex-1">
          <Input name="nome" defaultValue={g.nome} maxLength={60} />
        </Field>
        <Button type="submit" variant="primario" loading={pending}>
          Aprovar
        </Button>
      </div>
      <p className="text-sm text-ink-muted">
        O código está na página de Wi-Fi do gravador: aperte o botão 5 vezes, conecte o celular na rede do gravador e ele aparece no topo. Depois de
        aprovado, o gravador começa a enviar as notas em até 15 min (ou na hora, se for desligado e ligado de novo).
      </p>
      <FormMessage tone="perigo">{erro}</FormMessage>
    </form>
  );
}
