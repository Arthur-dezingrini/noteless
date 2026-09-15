import { getOrganizations, getUsuarios, requireSession } from "@/lib/auth/dal";

import { UsuariosLista } from "./usuarios-lista";

export const metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const [{ user }, [org]] = await Promise.all([requireSession(), getOrganizations()]);

  if (!org) {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  const usuarios = await getUsuarios(org.id);
  const eu = usuarios.find((u) => u.id === user.id);
  const possoGerenciar = eu?.role === "owner" || eu?.role === "admin";

  return (
    <UsuariosLista
      orgId={org.id}
      usuarios={usuarios}
      meuId={user.id}
      possoGerenciar={possoGerenciar}
    />
  );
}
