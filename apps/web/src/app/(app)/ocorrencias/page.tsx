import { getAnimais, getMemberRole, getOcorrencias, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { OcorrenciasView } from "./ocorrencias-view";

export const metadata = { title: "Ocorrências" };

export default async function OcorrenciasPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);

  if (!org) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-[15px] text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  const [ocorrencias, animais, membro] = await Promise.all([
    getOcorrencias(org.id),
    getAnimais(org.id),
    getMemberRole(org.id),
  ]);

  return (
    <OcorrenciasView
      orgId={org.id}
      ocorrencias={ocorrencias}
      animais={animais.map((a) => ({ id: a.id, nome: a.nome, sexo: a.sexo ?? null }))}
      podeSalvar={membro?.role === "owner" || membro?.role === "admin"}
    />
  );
}
