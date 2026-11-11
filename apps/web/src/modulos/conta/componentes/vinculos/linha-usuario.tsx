"use client";

import { PAPEIS, ROTULO_PAPEL, type Papel, type UsuarioAdmin, type Vinculo } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, ConfirmBar, FormMessage, Select, StatusText } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

type Confirmar = { tipo: "desvincular"; vinculo: Vinculo } | { tipo: "super" } | null;

/** Uma pessoa: as empresas em que está (com papel) e o que o super usuário pode fazer com ela. */
export function LinhaUsuario({ usuario, souEu, onVincular }: { usuario: UsuarioAdmin; souEu: boolean; onVincular: () => void }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmar>(null);
  const [pending, start] = useTransition();
  const ehSuper = usuario.tipo === "super";

  const chamar = (caminho: string, init: RequestInit) =>
    start(async () => {
      const e = await chamarApi(caminho, init);
      setErro(e);
      if (!e) {
        setConfirmar(null);
        router.refresh();
      }
    });

  const mudarPapel = (v: Vinculo, papel: Papel) =>
    chamar(`/api/admin/vinculos/${v.memberId}`, { method: "PATCH", body: JSON.stringify({ papel }) });

  return (
    <Card padded className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-ink">
            {usuario.nome}
            {souEu ? <span className="font-normal text-ink-muted"> (você)</span> : null}
          </span>
          <span className="truncate text-sm text-ink-muted">
            {[usuario.email, usuario.cargo].filter(Boolean).join(" · ")}
          </span>
          {ehSuper ? <StatusText tone="ok">Super usuário</StatusText> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="pequeno" onClick={onVincular}>
            Vincular a uma empresa
          </Button>
          <Button variant="pequeno" onClick={() => setConfirmar({ tipo: "super" })}>
            {ehSuper ? "Tirar super usuário" : "Marcar como super usuário"}
          </Button>
        </div>
      </div>

      {usuario.vinculos.length === 0 ? (
        <p className="text-sm text-ink-muted">Não está em nenhuma empresa.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {usuario.vinculos.map((v) => (
            <li key={v.memberId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="text-[15px] text-ink">{v.empresa}</span>
              <span className="flex items-center gap-2">
                <Select
                  aria-label={`Papel em ${v.empresa}`}
                  value={v.papel}
                  disabled={pending}
                  onChange={(e) => mudarPapel(v, e.target.value as Papel)}
                >
                  {PAPEIS.map((p) => (
                    <option key={p} value={p}>
                      {ROTULO_PAPEL[p]}
                    </option>
                  ))}
                </Select>
                <Button variant="pequenoPerigo" onClick={() => setConfirmar({ tipo: "desvincular", vinculo: v })}>
                  Desvincular
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {confirmar?.tipo === "desvincular" && (
        <ConfirmBar
          confirmLabel="Desvincular"
          pending={pending}
          onCancel={() => setConfirmar(null)}
          onConfirm={() => chamar(`/api/admin/vinculos/${confirmar.vinculo.memberId}`, { method: "DELETE" })}
        >
          Tirar {usuario.nome} de {confirmar.vinculo.empresa}?
        </ConfirmBar>
      )}
      {confirmar?.tipo === "super" && (
        <ConfirmBar
          confirmLabel={ehSuper ? "Tirar" : "Marcar"}
          pending={pending}
          onCancel={() => setConfirmar(null)}
          onConfirm={() =>
            chamar(`/api/admin/usuarios/${usuario.id}`, { method: "PATCH", body: JSON.stringify({ tipo: ehSuper ? "comum" : "super" }) })
          }
        >
          {ehSuper
            ? `${usuario.nome} deixa de ser super usuário e não vê mais esta tela.`
            : `${usuario.nome} passa a vincular qualquer pessoa a qualquer empresa.`}
        </ConfirmBar>
      )}
      <FormMessage tone="perigo">{erro}</FormMessage>
    </Card>
  );
}
