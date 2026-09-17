import { getMemberRole, getOrgAtiva, getUsuarios, requireSession } from "@/lib/auth/dal";

import { UsuariosLista } from "./usuarios-lista";

export const metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);

  if (!org) {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  const [usuarios, papel] = await Promise.all([
    getUsuarios(org.id),
    getMemberRole(org.id),
  ]);
  const papelNaLista = usuarios.find((usuario) => usuario.id === user.id)?.role;
  const papelAtual = papel?.role ?? papelNaLista;
  const possoGerenciar = papelAtual === "owner" || papelAtual === "admin";

  return (
    <UsuariosLista
      orgId={org.id}
      usuarios={usuarios}
      meuId={user.id}
      possoGerenciar={possoGerenciar}
    />
  );
}
