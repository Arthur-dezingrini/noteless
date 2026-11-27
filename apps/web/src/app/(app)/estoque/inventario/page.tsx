import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { InventarioPainel } from "@/modulos/estoque";
import { getInventario, getInventarios, getLocais, getProdutos } from "@/modulos/estoque/dados";

export const metadata = { title: "Inventário" };

export default async function InventarioPage({ searchParams }: PageProps<"/estoque/inventario">) {
  const [, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const id = typeof q.id === "string" ? q.id : null;
  const [inventarios, atual, locais, produtos] = await Promise.all([
    getInventarios(org.id),
    id ? getInventario(org.id, id) : Promise.resolve(null),
    getLocais(org.id),
    getProdutos(org.id),
  ]);
  return <InventarioPainel orgId={org.id} inventarios={inventarios} atual={atual} locais={locais} produtos={produtos.filter((p) => p.ativo)} />;
}
