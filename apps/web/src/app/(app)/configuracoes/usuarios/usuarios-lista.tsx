"use client";

import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  ROTULO_PAPEL,
  vincularUsuarioSchema,
  type Usuario,
} from "@vocare/shared";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { initials } from "@/components/app/avatar";
import { Modal } from "@/components/app/modal";
import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { chamarApi, chamarApiJson } from "@/lib/api-client";
import { BRAND_NAME } from "@/lib/brand";

const inputClasses = campo;

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-ink-soft">
            {usuarios.length} {usuarios.length === 1 ? "pessoa com acesso" : "pessoas com acesso"}
          </p>
          {possoGerenciar && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setVinculando(true)} className={btn.secundario}>
                Vincular conta existente
              </button>
              <button type="button" onClick={() => setAdicionando(true)} className={btn.primario}>
                Cadastrar usuário
              </button>
            </div>
          )}
        </div>

        <ul className="rounded-card border border-line bg-white">
          {usuarios.map((u, i) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${i ? "border-t border-line-soft" : ""}`}>
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9e5dc] text-[13px] font-semibold text-ink">
                {initials(u.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">
                  {u.name}
                  {u.id === meuId && <span className="ml-1 font-normal text-ink-muted">(você)</span>}
                </p>
                <p className="truncate text-sm text-ink-muted">{[u.cargo, u.email].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="w-32 text-[15px] text-ink-soft">{ROTULO_PAPEL[u.role]}</span>
              {possoGerenciar && (
                <div className="flex w-40 shrink-0 justify-end gap-1">
                  <button type="button" onClick={() => setEditando(u)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-hover">
                    Editar
                  </button>
                  {u.id !== meuId && u.role !== "owner" && (
                    <button type="button" onClick={() => setRemovendo(u)} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger-bg">
                      Remover
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          Administrador confere notas e mexe em usuários e dados da conta. Membro grava notas e consulta, mas o que ele grava vai
          para um administrador conferir.
        </p>
      </div>

      {feedback && (
        <p role="status" className="mt-4 text-sm text-brand-ink">
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
    <Modal open={open} onClose={onClose} title="Cadastrar usuário" subtitle="A pessoa entra com o e-mail e a senha provisória.">
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
          <button type="button" onClick={onClose} className={btn.secundario}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={btn.primario}>
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
    <Modal open={open} onClose={onClose} title="Vincular conta existente" subtitle="Para quem já usa o sistema em outra conta.">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          Para quem já tem conta no {BRAND_NAME} por outra clínica ou fazenda. A pessoa
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
          <button type="button" onClick={onClose} className={btn.secundario}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={btn.primario}>
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
              <button type="button" onClick={fechar} className={btn.secundario}>
                Cancelar
              </button>
              <button type="submit" disabled={pending} className={btn.primario}>
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
            <button type="button" onClick={onClose} className={btn.secundario}>
              Cancelar
            </button>
            <button type="button" onClick={remover} disabled={pending} className={btn.perigoSolido}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Remover
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
