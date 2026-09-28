import { getAnimais, getGrupos, getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { GruposView } from "./grupos-view";

export const metadata = { title: "Grupos" };

export default async function GruposPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) {
    return <p className="rounded-card border border-line bg-white p-6 text-[15px] text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>;
  }

  const [grupos, animais, membro] = await Promise.all([getGrupos(org.id), getAnimais(org.id), getMemberRole(org.id)]);
  return (
    <GruposView
      orgId={org.id}
      grupos={grupos}
      animais={animais}
      possoRemover={membro?.role === "owner" || membro?.role === "admin"}
    />
  );
}
