"use client";

import { ROTULO_PAPEL, type Usuario } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { initials } from "@/components/app/avatar";
import { Button, buttonClass, Card, cx, FormMessage } from "@/components/ui";
import { AdicionarModal } from "./adicionar-modal";
import { EditarModal } from "./editar-modal";
import { RemoverModal } from "./remover-modal";
import { VincularModal } from "./vincular-modal";

export type Props = {
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
          Administrador confere notas e mexe em usuários e dados da conta. Membro grava notas e consulta, mas o que ele grava vai
          para um administrador conferir.
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
