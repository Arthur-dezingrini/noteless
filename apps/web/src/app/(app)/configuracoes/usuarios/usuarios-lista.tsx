"use client";

import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  ROTULO_PAPEL,
  vincularUsuarioSchema,
  type Usuario,
} from "@vocare/shared";
import { Link2, Loader2, Plus, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { Avatar } from "@/components/app/avatar";
import { Card, CardHeader } from "@/components/app/card";
import { Modal } from "@/components/app/modal";
import { Select } from "@/components/app/select";
import { chamarApi, chamarApiJson } from "@/lib/api-client";

const inputClasses =
  "w-full rounded-lg border border-field-border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20";

type Props = {
  orgId: string;
  usuarios: Usuario[];
  meuId: string;
  possoGerenciar: boolean;
};

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
  const [removendo, setRemovendo] = useState<Usuario | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardHeader
          title="Usuários do sistema"
          aside={
            possoGerenciar && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVinculando(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-surface"
                >
                  <Link2 className="size-4" /> Vincular usuário
                </button>
                <button
                  type="button"
                  onClick={() => setAdicionando(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover"
                >
                  <Plus className="size-4" /> Cadastrar usuário
                </button>
              </div>
            )
          }
        />
        {usuarios.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 pb-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <UsersRound className="size-5" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-ink">Nenhum usuário cadastrado</h3>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Os usuários autorizados podem ser cadastrados através do sistema.
            </p>
          </div>
        ) : (
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
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditando(u)}
                      className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-white hover:text-ink"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={u.id === meuId || u.role === "owner"}
                      onClick={() => setRemovendo(u)}
                      title={
                        u.id === meuId
                          ? "Você não pode deletar seu próprio usuário"
                          : u.role === "owner"
                            ? "O proprietário não pode ser deletado"
                            : "Deletar usuário"
                      }
                      className="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                    >
                      Deletar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {feedback && (
        <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand">
          {feedback}
        </p>
      )}

      <AdicionarModal
        open={adicionando}
        orgId={orgId}
        onClose={() => setAdicionando(false)}
        onDone={() => {
          setAdicionando(false);
          setFeedback("Usuário cadastrado com sucesso.");
          router.refresh();
        }}
      />

      <VincularModal
        open={vinculando}
        orgId={orgId}
        onClose={() => setVinculando(false)}
        onDone={(nome) => {
          setVinculando(false);
          setFeedback(`${nome} agora faz parte desta organização. A senha continua a que a pessoa já usa.`);
          router.refresh();
        }}
      />

      <EditarModal
        usuario={editando}
        orgId={orgId}
        onClose={() => setEditando(null)}
        onDone={() => {
          setEditando(null);
          setFeedback("Usuário atualizado com sucesso.");
          router.refresh();
        }}
      />

      <RemoverModal
        usuario={removendo}
        orgId={orgId}
        onClose={() => setRemovendo(null)}
        onDone={() => {
          setRemovendo(null);
          setFeedback("Usuário removido com sucesso.");
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
      confirmPassword: form.get("confirmPassword"),
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
    <Modal open={open} onClose={onClose} title="Cadastrar usuário">
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
        <Campo label="Status">
          <Select name="status" defaultValue="active" disabled>
            <option value="active">Ativo</option>
          </Select>
        </Campo>
        <Campo label="Senha">
          <input name="password" type="password" className={inputClasses} required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
        </Campo>
        <Campo label="Confirmação de senha">
          <input name="confirmPassword" type="password" className={inputClasses} required autoComplete="new-password" />
        </Campo>
        <p className="text-xs text-ink-muted">
          Ainda não enviamos e-mail: repasse a senha à pessoa e peça para trocar
          no primeiro acesso. Se a pessoa já tem conta em outra organização, use
          &ldquo;Vincular usuário&rdquo;.
        </p>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Cadastrar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VincularModal({
  open,
  orgId,
  onClose,
  onDone,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onDone: (nome: string) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const parsed = vincularUsuarioSchema.safeParse({
      email: form.get("email"),
      role: form.get("role"),
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    const formEl = e.currentTarget;
    start(async () => {
      const r = await chamarApiJson<{ id: string; name: string }>(`/api/org/${orgId}/usuarios/vincular`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!r.ok) return setErro(r.error);
      formEl.reset();
      onDone(r.data.name);
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Vincular usuário">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          Para quem já tem conta no VOCare por outra clínica ou fazenda. A pessoa
          passa a ver esta organização no seletor; nome e senha não mudam.
        </p>
        <Campo label="E-mail da conta">
          <input name="email" type="email" className={inputClasses} required autoComplete="off" placeholder="pessoa@exemplo.com" />
        </Campo>
        <Campo label="Papel nesta organização">
          <Select name="role" defaultValue="member">
            <option value="member">Membro — opera o sistema</option>
            <option value="admin">Administrador — gerencia usuários e dados</option>
          </Select>
        </Campo>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Vincular
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditarModal({
  usuario,
  orgId,
  onClose,
  onDone,
}: {
  usuario: Usuario | null;
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const ehDono = usuario?.role === "owner";

  function fechar() {
    setErro(null);
    onClose();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!usuario) return;
    setErro(null);
    const form = new FormData(e.currentTarget);
    const parsed = atualizarUsuarioSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      cargo: form.get("cargo") ?? "",
      ...(!ehDono && { role: form.get("role") }),
      password: form.get("password") || undefined,
      confirmPassword: form.get("confirmPassword") || undefined,
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

  return (
    <Modal open={usuario !== null} onClose={fechar} title="Editar usuário">
      {usuario && (
        <form key={usuario.id} onSubmit={submit} className="space-y-4">
          <Campo label="Nome">
            <input name="name" className={inputClasses} defaultValue={usuario.name} required />
          </Campo>
          <Campo label="E-mail">
            <input name="email" type="email" className={inputClasses} defaultValue={usuario.email} required autoComplete="off" />
          </Campo>
          <Campo label="Nova senha (opcional)">
            <input name="password" type="password" className={inputClasses} minLength={8} autoComplete="new-password" placeholder="Deixe em branco para manter" />
          </Campo>
          <Campo label="Confirmação da nova senha">
            <input name="confirmPassword" type="password" className={inputClasses} autoComplete="new-password" />
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

          <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={fechar} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
                Cancelar
              </button>
              <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-70">
                {pending && <Loader2 className="size-4 animate-spin" />}
                Salvar
              </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function RemoverModal({
  usuario,
  orgId,
  onClose,
  onDone,
}: {
  usuario: Usuario | null;
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function remover() {
    if (!usuario) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/usuarios/${usuario.id}`, {
        method: "DELETE",
      });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open={usuario !== null} onClose={onClose} title="Remover usuário">
      {usuario && (
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Tem certeza que deseja remover <strong>{usuario.name}</strong> da organização?
          </p>
          <p className="text-xs text-ink-muted">
            A conta não será apagada e poderá continuar pertencendo a outras organizações.
          </p>
          {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
              Cancelar
            </button>
            <button type="button" onClick={remover} disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70">
              {pending && <Loader2 className="size-4 animate-spin" />}
              Remover
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
