import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { FornecedoresLista } from "@/modulos/estoque";
import { getFornecedores } from "@/modulos/estoque/dados";

export const metadata = { title: "Fornecedores" };

export default async function FornecedoresPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  return <FornecedoresLista orgId={org.id} fornecedores={await getFornecedores(org.id)} />;
}
