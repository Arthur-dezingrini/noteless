import { CATEGORIAS_PRODUTO } from "@vocare/shared";

import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { SaldoPainel } from "@/modulos/estoque";
import { getLocais, getSaldo } from "@/modulos/estoque/dados";

export const metadata = { title: "Estoque" };

export default async function EstoquePage({ searchParams }: PageProps<"/estoque">) {
  const [, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const categoria = typeof q.categoria === "string" && (CATEGORIAS_PRODUTO as readonly string[]).includes(q.categoria) ? q.categoria : "";
  const [saldo, locais] = await Promise.all([getSaldo(org.id, categoria || undefined), getLocais(org.id)]);
  return <SaldoPainel orgId={org.id} saldo={saldo} locais={locais} categoria={categoria} />;
}
