import { getAnimais, getMemberRole, getOrganizations, requireSession } from "@/lib/auth/dal";

import { AnimaisLista } from "./animais-lista";

export const metadata = { title: "Animais" };

export default async function AnimaisPage() {
  await requireSession();
  const [org] = await getOrganizations();

  if (!org) {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  const [animais, membro] = await Promise.all([getAnimais(org.id), getMemberRole(org.id)]);
  const possoRemover = membro?.role === "owner" || membro?.role === "admin";

  return <AnimaisLista orgId={org.id} animais={animais} possoRemover={possoRemover} />;
}
