import { Card } from "@/components/ui";
import { getAnimais, getGrupos, getInstalacoes, getLotes, getMemberRole, getOcorrencias, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { NotasView } from "./notas-view";

// Na tela é "nota"; no contrato (api, banco, @vocare/shared) continua "ocorrência".
export const metadata = { title: "Notas" };

export default async function NotasPage({ searchParams }: PageProps<"/notas">) {
  const [, org, busca] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);

  if (!org) {
    return (
      <Card padded>
        <p className="text-[15px] text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>
      </Card>
    );
  }

  const [ocorrencias, animais, grupos, instalacoes, lotesAtivos, lotesEncerrados, membro] = await Promise.all([
    getOcorrencias(org.id),
    getAnimais(org.id),
    getGrupos(org.id),
    getInstalacoes(org.id),
    getLotes(org.id, "ativo"),
    getLotes(org.id, "encerrado"),
    getMemberRole(org.id),
  ]);

  return (
    <NotasView
      orgId={org.id}
      ocorrencias={ocorrencias}
      animais={animais.map((a) => ({ id: a.id, nome: a.nome, numero: a.numero ?? null, sexo: a.sexo ?? null }))}
      grupos={grupos.map((g) => ({ id: g.id, nome: g.nome, animais: g.animalIds.length }))}
      galpoes={instalacoes.map((i) => ({ id: i.id, nome: i.nome }))}
      lotes={[
        ...lotesAtivos.map((l) => ({ id: l.id, codigo: l.codigo, ativo: true })),
        ...lotesEncerrados.map((l) => ({ id: l.id, codigo: l.codigo, ativo: false })),
      ]}
      podeSalvar={membro?.role === "owner" || membro?.role === "admin"}
      selecionarId={typeof busca.id === "string" ? busca.id : undefined}
    />
  );
}
