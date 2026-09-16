"use client";

import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  ROTULO_PAPEL,
  type Usuario,
} from "@vocare/shared";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { Avatar } from "@/components/app/avatar";
import { Card, CardHeader } from "@/components/app/card";
import { Modal } from "@/components/app/modal";
import { Select } from "@/components/app/select";

const inputClasses =
  "w-full rounded-lg border border-field-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";

type Props = {
  orgId: string;
  usuarios: Usuario[];
  meuId: string;
  possoGerenciar: boolean;
};

/** Chamada à api pelo rewrite (/api/* → apps/api); o cookie vai junto. */
async function chamarApi(path: string, init: RequestInit): Promise<string | null> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Não foi possível concluir. Tente de novo.";
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export function UsuariosLista({ orgId, usuarios, meuId, possoGerenciar }: Props) {
  const router = useRouter();
  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);

  return (
    <>
      <Card>
        <CardHeader
          title="Usuários do sistema"
          aside={
            possoGerenciar && (
              <button
                type="button"
                onClick={() => setAdicionando(true)}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                <Plus className="size-4" /> Adicionar usuário
              </button>
            )
          }
        />
        <ul className="space-y-2 px-5 pb-5">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-lg bg-surface px-3 py-3"
            >
              <Avatar name={u.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {u.name}
                  {u.id === meuId && (
                    <span className="ml-2 text-xs font-normal text-ink-muted">(você)</span>
                  )}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {[ROTULO_PAPEL[u.role], u.cargo, u.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              {possoGerenciar && (
                <button
                  type="button"
                  onClick={() => setEditando(u)}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-white hover:text-ink"
                >
                  Editar
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <AdicionarModal
        open={adicionando}
        orgId={orgId}
        onClose={() => setAdicionando(false)}
        onDone={() => {
          setAdicionando(false);
          router.refresh();
        }}
      />

      <EditarModal
        usuario={editando}
        orgId={orgId}
        meuId={meuId}
        onClose={() => setEditando(null)}
        onDone={() => {
          setEditando(null);
          router.refresh();
        }}
      />
    </>
  );
}

function AdicionarModal({
  open,
  orgId,
  onClose,
  onDone,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const parsed = criarUsuarioSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      cargo: form.get("cargo") || undefined,
      role: form.get("role"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setErro(z.flattenError(parsed.error).formErrors[0] ?? parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    const formEl = e.currentTarget;
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/usuarios`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (err) return setErro(err);
      formEl.reset();
      onDone();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar usuário">
      <form onSubmit={submit} className="space-y-4">
        <Campo label="Nome">
          <input name="name" className={inputClasses} required autoComplete="off" />
        </Campo>
        <Campo label="E-mail">
          <input name="email" type="email" className={inputClasses} required autoComplete="off" />
        </Campo>
        <Campo label="Cargo">
          <input name="cargo" className={inputClasses} placeholder="Veterinária, Recepcionista, Peão…" />
        </Campo>
        <Campo label="Papel">
          <Select name="role" defaultValue="member">
            <option value="member">Membro — opera o sistema</option>
            <option value="admin">Administrador — gerencia usuários e dados</option>
          </Select>
        </Campo>
        <Campo label="Senha temporária">
          <input name="password" type="text" className={inputClasses} required minLength={8} autoComplete="off" placeholder="Mínimo 8 caracteres" />
        </Campo>
        <p className="text-xs text-ink-muted">
          Ainda não enviamos e-mail: repasse a senha à pessoa e peça para trocar
          no primeiro acesso.
        </p>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Adicionar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditarModal({
  usuario,
  orgId,
  meuId,
  onClose,
  onDone,
}: {
  usuario: Usuario | null;
  orgId: string;
  meuId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const souEu = usuario?.id === meuId;
  const ehDono = usuario?.role === "owner";

  function fechar() {
    setErro(null);
    setConfirmarRemocao(false);
    onClose();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!usuario) return;
    setErro(null);
    const form = new FormData(e.currentTarget);
    const parsed = atualizarUsuarioSchema.safeParse({
      name: form.get("name"),
      cargo: form.get("cargo") ?? "",
      ...(!ehDono && { role: form.get("role") }),
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/usuarios/${usuario.id}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (err) return setErro(err);
      onDone();
    });
  }

  function remover() {
    if (!usuario) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/usuarios/${usuario.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      setConfirmarRemocao(false);
      onDone();
    });
  }

  return (
    <Modal open={usuario !== null} onClose={fechar} title="Editar usuário">
      {usuario && (
        <form key={usuario.id} onSubmit={submit} className="space-y-4">
          <Campo label="Nome">
            <input name="name" className={inputClasses} defaultValue={usuario.name} required />
          </Campo>
          <Campo label="E-mail">
            <input className={`${inputClasses} bg-surface text-ink-muted`} value={usuario.email} disabled />
          </Campo>
          <Campo label="Cargo">
            <input name="cargo" className={inputClasses} defaultValue={usuario.cargo ?? ""} placeholder="Veterinária, Recepcionista, Peão…" />
          </Campo>
          <Campo label="Papel">
            {ehDono ? (
              <input className={`${inputClasses} bg-surface text-ink-muted`} value="Dono da organização" disabled />
            ) : (
              <Select name="role" defaultValue={usuario.role}>
                <option value="member">Membro — opera o sistema</option>
                <option value="admin">Administrador — gerencia usuários e dados</option>
              </Select>
            )}
          </Campo>

          {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}

          {confirmarRemocao && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              <span>
                Remover <strong>{usuario.name}</strong> da organização?
              </span>
              <span className="flex shrink-0 gap-3 text-xs font-semibold">
                <button type="button" onClick={remover} disabled={pending} className="text-red-700 hover:underline disabled:opacity-60">
                  Sim, remover
                </button>
                <button type="button" onClick={() => setConfirmarRemocao(false)} className="text-ink-muted hover:underline">
                  Não
                </button>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            {!souEu && !ehDono && !confirmarRemocao ? (
              <button type="button" onClick={() => setConfirmarRemocao(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline">
                <Trash2 className="size-3.5" /> Remover da organização
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={fechar} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
                Cancelar
              </button>
              <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
                {pending && <Loader2 className="size-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
