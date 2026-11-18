"use client";

import { atualizacaoEmPalavras, type Firmware, type Gravador } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, FormMessage, Select, StatusText } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

/** A situação do firmware de uma placa, em uma linha: versão, alvo e andamento. */
export function situacaoDoFirmware(g: Gravador): { texto: string; tom: "ok" | "aviso" | "perigo" | null } {
  const a = g.estado.atualizacao;
  if (a && a.versao === g.firmwareAlvo && a.etapa === "falhou") return { texto: atualizacaoEmPalavras(a), tom: "perigo" };
  if (g.firmwareAlvo && g.firmwareAlvo !== g.estado.versao) {
    return { texto: a && a.versao === g.firmwareAlvo ? atualizacaoEmPalavras(a) : `Vai atualizar para a ${g.firmwareAlvo}`, tom: "aviso" };
  }
  return { texto: "", tom: null };
}

/** No painel da placa (super usuário): escolher a versão que ela deve ter, ou cancelar. */
export function FirmwareGravador({ g, firmwares }: { g: Gravador; firmwares: Firmware[] }) {
  const router = useRouter();
  const [versao, setVersao] = useState(g.firmwareAlvo ?? firmwares[0]?.versao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const mudar = (firmwareAlvo: string | null) =>
    start(async () => {
      const e = await chamarApi(`/api/admin/gravadores/${g.id}`, { method: "PATCH", body: JSON.stringify({ firmwareAlvo }) });
      setErro(e);
      if (!e) router.refresh();
    });

  if (firmwares.length === 0)
    return <p className="text-sm text-ink-muted">Nenhuma versão publicada: publique o firmware na seção Firmware, abaixo da lista.</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="Versão do firmware" value={versao} onChange={(e) => setVersao(e.target.value)} disabled={pending} className="w-40">
          {firmwares.map((f) => (
            <option key={f.versao} value={f.versao}>
              {f.versao}
            </option>
          ))}
        </Select>
        <Button variant="pequeno" loading={pending} onClick={() => mudar(versao)} disabled={!versao || versao === g.firmwareAlvo}>
          Atualizar para esta
        </Button>
        {g.firmwareAlvo && (
          <Button variant="pequeno" onClick={() => mudar(null)} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
      {g.firmwareAlvo ? (
        <StatusText tone="neutro" size="sm">
          Alvo: {g.firmwareAlvo}
          {g.firmwareAlvo === g.estado.versao ? " (já instalada)" : ""}
        </StatusText>
      ) : null}
      <FormMessage tone="perigo">{erro}</FormMessage>
    </div>
  );
}
