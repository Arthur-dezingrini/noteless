import { getOcorrencias, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { OcorrenciasView } from "./ocorrencias-view";

export const metadata = { title: "Registros de Ocorrências" };

export default async function OcorrenciasPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);

  if (!org) {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  const ocorrencias = await getOcorrencias(org.id);

  return <OcorrenciasView orgId={org.id} ocorrencias={ocorrencias} />;
}
