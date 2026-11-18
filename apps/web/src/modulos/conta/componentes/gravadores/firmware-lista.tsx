"use client";

import type { Firmware } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Card, ConfirmBar, FormMessage } from "@/components/ui";
import { chamarApiJson } from "@/lib/api-client";
import { haQuantoTempo } from "@/lib/datas";

/**
 * Configurações › Gravadores › Firmware (só super usuário): publicar o .bin que
 * o arduino-cli gera e pôr uma versão em todas as placas. A versão vem de
 * dentro do arquivo (FIRMWARE_VERSAO no gravador.ino); cada placa baixa e
 * instala sozinha quando estiver parada.
 */
export function FirmwareLista({ firmwares }: { firmwares: Firmware[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [todas, setTodas] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function publicar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const dados = new FormData(form);
    const arquivo = dados.get("firmware");
    if (!(arquivo instanceof File) || arquivo.size === 0) return setErro("Escolha o arquivo .bin do firmware.");
    start(async () => {
      setErro(null);
      setAviso(null);
      // Sem Content-Type: o navegador põe o do multipart.
      const res = await fetch("/api/admin/gravadores/firmware", { method: "POST", body: dados });
      const corpo = (await res.json().catch(() => null)) as { versao?: string; error?: string } | null;
      if (!res.ok) return setErro(corpo?.error ?? "Não foi possível publicar. Tente de novo.");
      setAviso(`Versão ${corpo?.versao} publicada. Escolha as placas que vão recebê-la.`);
      form.reset();
      router.refresh();
    });
  }

  function atualizarTodas(versao: string) {
    start(async () => {
      const r = await chamarApiJson<{ placas: number }>(`/api/admin/gravadores/firmware/${encodeURIComponent(versao)}/todas`, { method: "POST" });
      setTodas(null);
      if (!r.ok) return setErro(r.error);
      setErro(null);
      setAviso(`${r.data.placas} placa(s) vão instalar a ${versao} quando estiverem paradas.`);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold text-ink">Firmware</h2>
        <p className="text-sm text-ink-muted">
          A placa baixa a versão escolhida quando está parada, confere a assinatura e instala. Se a nova não funcionar, ela volta sozinha para a
          anterior.
        </p>
      </div>

      <form onSubmit={publicar} className="flex flex-wrap items-center gap-3">
        <input name="firmware" type="file" accept=".bin,application/octet-stream" className="text-sm text-ink" aria-label="Arquivo do firmware (.bin)" />
        <Button type="submit" variant="primario" loading={pending}>
          Publicar
        </Button>
      </form>

      {firmwares.length === 0 ? (
        <p className="text-[15px] text-ink-muted">Nenhuma versão publicada ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-field border border-line">
          {firmwares.map((f) => (
            <li key={f.versao} className="flex flex-col gap-2 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[15px] text-ink">
                  <span className="font-semibold">{f.versao}</span>
                  <span className="text-ink-muted" suppressHydrationWarning>
                    {" "}
                    · {Math.round(f.tamanho / 1024).toLocaleString("pt-BR")} KB · {haQuantoTempo(new Date(f.publicadoEm))}
                    {f.publicadoPor ? ` · ${f.publicadoPor}` : ""}
                  </span>
                </span>
                <Button variant="pequeno" onClick={() => setTodas(f.versao)}>
                  Atualizar todas
                </Button>
              </div>
              {todas === f.versao && (
                <ConfirmBar confirmLabel="Atualizar todas" pending={pending} onCancel={() => setTodas(null)} onConfirm={() => atualizarTodas(f.versao)}>
                  Todas as placas aprovadas vão instalar a {f.versao} quando estiverem paradas.
                </ConfirmBar>
              )}
            </li>
          ))}
        </ul>
      )}

      <FormMessage tone="ok">{aviso}</FormMessage>
      <FormMessage tone="perigo">{erro}</FormMessage>
    </Card>
  );
}
