import { Card } from "@/components/ui";
import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { GalpoesLista } from "@/modulos/aviario";
import { getInstalacoes } from "@/modulos/aviario/dados";

export const metadata = { title: "Galpões" };

export default async function GalpoesPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);

  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const [instalacoes, papel] = await Promise.all([getInstalacoes(org.id), getMemberRole(org.id)]);
  const possoGerenciar = papel?.role === "owner" || papel?.role === "admin";

  return <GalpoesLista orgId={org.id} instalacoes={instalacoes} possoGerenciar={possoGerenciar} />;
}
