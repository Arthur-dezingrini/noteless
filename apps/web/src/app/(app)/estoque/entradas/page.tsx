import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { EntradasLista } from "@/modulos/estoque";
import { getEntradas, getFornecedores, getLocais, getProdutos } from "@/modulos/estoque/dados";

export const metadata = { title: "Entradas do estoque" };

export default async function EntradasPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const [entradas, produtos, locais, fornecedores] = await Promise.all([
    getEntradas(org.id),
    getProdutos(org.id),
    getLocais(org.id),
    getFornecedores(org.id),
  ]);
  return <EntradasLista orgId={org.id} entradas={entradas} produtos={produtos} locais={locais} fornecedores={fornecedores} />;
}
