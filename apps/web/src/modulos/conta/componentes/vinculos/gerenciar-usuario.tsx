"use client";

import { criarVinculoSchema, PAPEIS, ROTULO_PAPEL, type Empresa, type Papel, type UsuarioAdmin, type Vinculo } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button, ConfirmBar, Field, FormMessage, Modal, Select, StatusText } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

type Confirmar = { tipo: "desvincular"; vinculo: Vinculo } | { tipo: "super" } | null;

/** Tudo o que o super usuário faz com uma pessoa: empresas e papéis, vincular, super usuário. */
export function GerenciarUsuario({
  usuario,
  empresas,
  souEu,
  onClose,
}: {
  usuario: UsuarioAdmin | null;
  empresas: Empresa[];
  souEu: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmar>(null);
  const [pending, start] = useTransition();

  const fechar = () => {
    setErro(null);
    setConfirmar(null);
    onClose();
  };

  const chamar = (caminho: string, init: RequestInit, depois?: () => void) =>
    start(async () => {
      const e = await chamarApi(caminho, init);
      setErro(e);
      if (!e) {
        setConfirmar(null);
        depois?.();
        router.refresh();
      }
    });

  if (!usuario) return null;

  const ehSuper = usuario.tipo === "super";
  const livres = empresas.filter((e) => !usuario.vinculos.some((v) => v.organizationId === e.id));

  function vincular(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const dados = new FormData(form);
    const parsed = criarVinculoSchema.safeParse({ userId: usuario!.id, organizationId: dados.get("empresa"), papel: dados.get("papel") });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    chamar("/api/admin/vinculos", { method: "POST", body: JSON.stringify(parsed.data) }, () => form.reset());
  }

  return (
    <Modal open onClose={fechar} title={usuario.nome + (souEu ? " (você)" : "")} subtitle={usuario.email} wide>
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-ink">Empresas</h3>
          {usuario.vinculos.length === 0 ? (
            <p className="text-[15px] text-ink-muted">Não está em nenhuma empresa.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-field border border-line">
              {usuario.vinculos.map((v) => (
                <li key={v.memberId} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="text-[15px] text-ink">{v.empresa}</span>
                  <span className="flex items-center gap-2">
                    <Select
                      aria-label={`Papel em ${v.empresa}`}
                      value={v.papel}
                      disabled={pending}
                      onChange={(e) =>
                        chamar(`/api/admin/vinculos/${v.memberId}`, { method: "PATCH", body: JSON.stringify({ papel: e.target.value as Papel }) })
                      }
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
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-ink">Vincular a uma empresa</h3>
          {livres.length === 0 ? (
            <p className="text-[15px] text-ink-muted">Essa pessoa já está em todas as empresas.</p>
          ) : (
            <form onSubmit={vincular} className="flex flex-wrap items-end gap-3">
              <Field label="Empresa" className="min-w-48 flex-1">
                <Select name="empresa" defaultValue={livres[0]?.id}>
                  {livres.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Papel" className="w-44">
                <Select name="papel" defaultValue="member">
                  {PAPEIS.map((p) => (
                    <option key={p} value={p}>
                      {ROTULO_PAPEL[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="primario" loading={pending}>
                Vincular
              </Button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[15px] text-ink">
              {ehSuper ? <StatusText tone="ok">Super usuário</StatusText> : "Usuário comum"}
            </span>
            <Button variant="pequeno" onClick={() => setConfirmar({ tipo: "super" })}>
              {ehSuper ? "Tirar super usuário" : "Marcar como super usuário"}
            </Button>
          </div>
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
        </section>

        <FormMessage tone="perigo">{erro}</FormMessage>
      </div>
    </Modal>
  );
}
