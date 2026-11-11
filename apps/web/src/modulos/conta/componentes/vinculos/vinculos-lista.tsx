"use client";

import type { Empresa, UsuarioAdmin } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, EmptyState, Input } from "@/components/ui";

import { LinhaUsuario } from "./linha-usuario";
import { VincularModal } from "./vincular-modal";

/** Configurações › Vínculos: qualquer pessoa em qualquer empresa (só super usuário). */
export function VinculosLista({
  usuarios,
  empresas,
  busca,
  meuId,
}: {
  usuarios: UsuarioAdmin[];
  empresas: Empresa[];
  busca: string;
  meuId: string;
}) {
  const router = useRouter();
  const [vinculando, setVinculando] = useState<UsuarioAdmin | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap gap-2">
        <Input name="busca" defaultValue={busca} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuário" className="max-w-sm" />
        <Button type="submit">Buscar</Button>
      </form>

      {usuarios.length === 0 ? (
        <EmptyState title="Ninguém encontrado" description={busca ? "Tente outro nome ou e-mail." : "Ainda não há usuários."} />
      ) : (
        usuarios.map((u) => <LinhaUsuario key={u.id} usuario={u} souEu={u.id === meuId} onVincular={() => setVinculando(u)} />)
      )}

      <VincularModal
        usuario={vinculando}
        empresas={empresas}
        onClose={() => setVinculando(null)}
        onDone={() => {
          setVinculando(null);
          router.refresh();
        }}
      />
    </div>
  );
}
