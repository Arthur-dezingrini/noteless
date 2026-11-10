import { Card } from "@/components/ui";
import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { LotesLista } from "@/modulos/aviario";
import { getInstalacoes, getLotes } from "@/modulos/aviario/dados";

export const metadata = { title: "Lotes" };

export default async function LotesPage({ searchParams }: PageProps<"/aviario/lotes">) {
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
