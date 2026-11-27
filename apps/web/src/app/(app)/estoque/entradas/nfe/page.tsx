import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { NfeImportar } from "@/modulos/estoque";
import { getLocais, getProdutos } from "@/modulos/estoque/dados";

export const metadata = { title: "Importar NF-e" };

export default async function NfePage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const [produtos, locais] = await Promise.all([getProdutos(org.id), getLocais(org.id)]);
  return <NfeImportar orgId={org.id} produtos={produtos} locais={locais} />;
}
