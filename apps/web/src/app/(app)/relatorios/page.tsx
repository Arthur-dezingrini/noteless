import { PERIODOS, tipoRelatorioSchema, type Periodo } from "@vocare/shared";

import { getOrgAtiva, getRelatorio, requireSession } from "@/lib/auth/dal";

import { RelatoriosView } from "./relatorios-view";

export const metadata = { title: "Relatórios" };

export default async function RelatoriosPage({ searchParams }: PageProps<"/relatorios">) {
  const [, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);
  if (!org) {
    return <p className="rounded-card border border-line bg-white p-6 text-[15px] text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>;
  }

  const tipo = tipoRelatorioSchema.catch("vacinas").parse(q.tipo);
  const periodo: Periodo = (PERIODOS as readonly unknown[]).includes(q.periodo) ? (q.periodo as Periodo) : "mes";
  const animalId = typeof q.animal === "string" ? q.animal : undefined;
  const relatorio = await getRelatorio(org.id, tipo, { periodo, animalId });

  return <RelatoriosView tipo={tipo} periodo={periodo} relatorio={relatorio} />;
}
