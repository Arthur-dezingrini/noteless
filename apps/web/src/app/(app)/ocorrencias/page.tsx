import { Card } from "@/components/ui";
import { getAnimais, getGrupos, getMemberRole, getOcorrencias, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { OcorrenciasView } from "./ocorrencias-view";

export const metadata = { title: "Ocorrências" };

export default async function OcorrenciasPage({ searchParams }: PageProps<"/ocorrencias">) {
  const [, org, busca] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);

  if (!org) {
    return (
      <Card padded>
        <p className="text-[15px] text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>
      </Card>
    );
  }

  const [ocorrencias, animais, grupos, membro] = await Promise.all([
    getOcorrencias(org.id),
    getAnimais(org.id),
    getGrupos(org.id),
    getMemberRole(org.id),
  ]);

  return (
    <OcorrenciasView
      orgId={org.id}
      ocorrencias={ocorrencias}
      animais={animais.map((a) => ({ id: a.id, nome: a.nome, numero: a.numero ?? null, sexo: a.sexo ?? null }))}
      grupos={grupos.map((g) => ({ id: g.id, nome: g.nome, animais: g.animalIds.length }))}
      podeSalvar={membro?.role === "owner" || membro?.role === "admin"}
      selecionarId={typeof busca.id === "string" ? busca.id : undefined}
    />
  );
}
