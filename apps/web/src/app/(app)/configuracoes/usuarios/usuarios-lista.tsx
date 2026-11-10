"use client";

import { atualizarUsuarioSchema, criarUsuarioSchema, ROTULO_PAPEL, vincularUsuarioSchema, type Usuario } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { z } from "zod";

import { initials } from "@/components/app/avatar";
import { Button, buttonClass, Card, cx, Field, FormMessage, Input, Modal, Select } from "@/components/ui";
import { chamarApi, chamarApiJson } from "@/lib/api-client";
import { BRAND_NAME } from "@/lib/brand";

type Props = {
  orgId: string;
  usuarios: Usuario[];
  meuId: string;
  possoGerenciar: boolean;
};

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
              <Button onClick={() => setVinculando(true)}>Vincular conta existente</Button>
              <Button variant="primario" onClick={() => setAdicionando(true)}>
                Cadastrar usuário
              </Button>
            </div>
          )}
        </div>

        <Card as="ul">
          {usuarios.map((u, i) => (
            <li key={u.id} className={cx("flex flex-wrap items-center gap-3 px-5 py-3", i > 0 && "border-t border-line-soft")}>
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9e5dc] text-[13px] font-semibold text-ink"
              >
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
                  <button
                    type="button"
                    onClick={() => setEditando(u)}
                    className={buttonClass("linha")}
                  >
                    Editar
                  </button>
                  {u.id !== meuId && u.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => setRemovendo(u)}
                      className={buttonClass("linhaPerigo")}
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </Card>

        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          Administrador confere ocorrências e mexe em usuários e dados da conta. Membro grava ocorrências e consulta, mas o que ele grava
          vai para um administrador conferir.
        </p>
      </div>

      {feedback && (
        <FormMessage tone="ok" className="mt-4">
          {feedback}
        </FormMessage>
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

function AdicionarModal({ open, orgId, onClose, onDone }: { open: boolean; orgId: string; onClose: () => void; onDone: () => void }) {
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
        <Field label="Nome">
          <Input name="name" required autoComplete="off" />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Cargo">
          <Input name="cargo" placeholder="Veterinária, Recepcionista, Peão…" />
        </Field>
        <Field label="Papel">
          <Select name="role" defaultValue="member">
            <option value="member">Membro — opera o sistema</option>
            <option value="admin">Administrador — gerencia usuários e dados</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="active" disabled>
            <option value="active">Ativo</option>
          </Select>
        </Field>
        <Field label="Senha">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
        </Field>
        <Field label="Confirmação de senha">
          <Input name="confirmPassword" type="password" required autoComplete="new-password" />
        </Field>
        <p className="text-xs text-ink-muted">
          Ainda não enviamos e-mail: repasse a senha à pessoa e peça para trocar no primeiro acesso. Se a pessoa já tem conta em outra
          organização, use &ldquo;Vincular usuário&rdquo;.
        </p>
        {erro && <FormMessage>{erro}</FormMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primario" loading={pending}>
            Cadastrar
          </Button>
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
          Para quem já tem conta no {BRAND_NAME} por outra clínica ou fazenda. A pessoa passa a ver esta organização no seletor; nome e
          senha não mudam.
        </p>
        <Field label="E-mail da conta">
          <Input name="email" type="email" required autoComplete="off" placeholder="pessoa@exemplo.com" />
        </Field>
        <Field label="Papel nesta organização">
          <Select name="role" defaultValue="member">
            <option value="member">Membro — opera o sistema</option>
            <option value="admin">Administrador — gerencia usuários e dados</option>
          </Select>
        </Field>
        {erro && <FormMessage>{erro}</FormMessage>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primario" loading={pending}>
            Vincular
          </Button>
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
          <Field label="Nome">
            <Input name="name" defaultValue={usuario.name} required />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" defaultValue={usuario.email} required autoComplete="off" />
          </Field>
          <Field label="Nova senha (opcional)">
            <Input name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Deixe em branco para manter" />
          </Field>
          <Field label="Confirmação da nova senha">
            <Input name="confirmPassword" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Cargo">
            <Input name="cargo" defaultValue={usuario.cargo ?? ""} placeholder="Veterinária, Recepcionista, Peão…" />
          </Field>
          <Field label="Papel">
            {ehDono ? (
              <Input className="bg-surface text-ink-muted" value="Dono da organização" disabled />
            ) : (
              <Select name="role" defaultValue={usuario.role}>
                <option value="member">Membro — opera o sistema</option>
                <option value="admin">Administrador — gerencia usuários e dados</option>
              </Select>
            )}
          </Field>

          {erro && <FormMessage>{erro}</FormMessage>}

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={fechar}>Cancelar</Button>
            <Button type="submit" variant="primario" loading={pending}>
              Salvar
            </Button>
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
          <p className="text-xs text-ink-muted">A conta não será apagada e poderá continuar pertencendo a outras organizações.</p>
          {erro && <FormMessage>{erro}</FormMessage>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="perigoSolido" onClick={remover} loading={pending}>
              Remover
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
