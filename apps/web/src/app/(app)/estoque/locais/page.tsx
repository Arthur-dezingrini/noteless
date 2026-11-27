import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { getInstalacoes } from "@/modulos/aviario/dados";
import { LocaisLista } from "@/modulos/estoque";
import { getLocais } from "@/modulos/estoque/dados";

export const metadata = { title: "Locais do estoque" };

export default async function LocaisPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const [locais, instalacoes] = await Promise.all([getLocais(org.id), getInstalacoes(org.id)]);
  const galpoes = instalacoes.filter((i) => i.ativa).map((i) => ({ id: i.id, nome: i.nome }));
  return <LocaisLista orgId={org.id} locais={locais} galpoes={galpoes} />;
}
