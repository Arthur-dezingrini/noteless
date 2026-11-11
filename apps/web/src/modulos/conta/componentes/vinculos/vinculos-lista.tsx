"use client";

import type { Empresa, UsuarioAdmin } from "@vocare/shared";
import { useState, type KeyboardEvent } from "react";

import { Button, Card, cx, EmptyState, Input, StatusText, tabela } from "@/components/ui";

import { GerenciarUsuario } from "./gerenciar-usuario";

const MAX_EMPRESAS = 3;

function empresas(u: UsuarioAdmin) {
  if (u.vinculos.length === 0) return "—";
  const nomes = u.vinculos.slice(0, MAX_EMPRESAS).map((v) => v.empresa).join(", ");
  return u.vinculos.length > MAX_EMPRESAS ? `${nomes} +${u.vinculos.length - MAX_EMPRESAS}` : nomes;
}

/** Configurações › Vínculos: todos os usuários; clicar abre o que dá para fazer com cada um (só super usuário). */
export function VinculosLista({
  usuarios,
  empresas: todasEmpresas,
  busca,
  meuId,
}: {
  usuarios: UsuarioAdmin[];
  empresas: Empresa[];
  busca: string;
  meuId: string;
}) {
  // Guarda o id: depois de salvar, a lista nova chega e o modal mostra a versão atualizada.
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = usuarios.find((u) => u.id === abertoId) ?? null;

  const teclas = (e: KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setAbertoId(id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap gap-2">
        <Input name="busca" defaultValue={busca} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuário" className="max-w-sm" />
        <Button type="submit">Buscar</Button>
      </form>

      <Card className="overflow-hidden">
        {usuarios.length === 0 ? (
          <EmptyState title="Ninguém encontrado" description={busca ? "Tente outro nome ou e-mail." : "Ainda não há usuários."} />
        ) : (
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Nome</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>E-mail</th>
                <th className={tabela.th}>Empresas</th>
                <th className={cx(tabela.th, "hidden w-36 sm:table-cell")}>Tipo</th>
                <th className={cx(tabela.th, "w-32")}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  className={tabela.linhaClicavel}
                  tabIndex={0}
                  aria-label={`Gerenciar ${u.nome}`}
                  onClick={() => setAbertoId(u.id)}
                  onKeyDown={(e) => teclas(e, u.id)}
                >
                  <td className={cx(tabela.td, "truncate font-semibold text-ink")}>
                    {u.nome}
                    {u.id === meuId ? <span className="font-normal text-ink-muted"> (você)</span> : null}
                  </td>
                  <td className={cx(tabela.td, "hidden truncate text-ink-muted md:table-cell")}>{u.email}</td>
                  <td className={cx(tabela.td, "truncate text-ink")}>{empresas(u)}</td>
                  <td className={cx(tabela.td, "hidden sm:table-cell")}>
                    {u.tipo === "super" ? <StatusText tone="ok">Super usuário</StatusText> : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className={tabela.td}>
                    <Button
                      variant="pequeno"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAbertoId(u.id);
                      }}
                    >
                      Gerenciar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <GerenciarUsuario usuario={aberto} empresas={todasEmpresas} souEu={aberto?.id === meuId} onClose={() => setAbertoId(null)} />
    </div>
  );
}
