import { PERIODOS, tipoRelatorioSchema, type Periodo } from "@vocare/shared";

import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { getRelatorio } from "@/modulos/painel/dados";

import { RelatoriosView } from "@/modulos/painel";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage({ searchParams }: PageProps<"/relatorios">) {
  const [, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);
  if (!org) {
    return (
      <Card padded>
        <p className="text-[15px] text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>
      </Card>
    );
  }

  const tipo = tipoRelatorioSchema.catch("vacinas").parse(q.tipo);
  const periodo: Periodo = (PERIODOS as readonly unknown[]).includes(q.periodo) ? (q.periodo as Periodo) : "mes";
  const animalId = typeof q.animal === "string" ? q.animal : undefined;
  const relatorio = await getRelatorio(org.id, tipo, { periodo, animalId });

  return <RelatoriosView tipo={tipo} periodo={periodo} relatorio={relatorio} />;
}
