import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { ProdutosLista } from "@/modulos/estoque";
import { getProdutos } from "@/modulos/estoque/dados";

export const metadata = { title: "Produtos do estoque" };

export default async function ProdutosPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  return <ProdutosLista orgId={org.id} produtos={await getProdutos(org.id)} />;
}
