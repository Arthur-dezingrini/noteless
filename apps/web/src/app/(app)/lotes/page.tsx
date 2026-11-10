import { Card } from "@/components/ui";
import { getInstalacoes, getLotes, getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { LotesLista } from "./lotes-lista";

export const metadata = { title: "Lotes" };

export default async function LotesPage({ searchParams }: PageProps<"/lotes">) {
  const [, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);

  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const situacao = q.situacao === "encerrado" ? "encerrado" : "ativo";
  const [lotes, instalacoes, papel] = await Promise.all([
    getLotes(org.id, situacao),
    getInstalacoes(org.id),
    getMemberRole(org.id),
  ]);
  const possoGerenciar = papel?.role === "owner" || papel?.role === "admin";

  return <LotesLista orgId={org.id} situacao={situacao} lotes={lotes} instalacoes={instalacoes} possoGerenciar={possoGerenciar} />;
}
