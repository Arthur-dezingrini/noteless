import { getOrgAtiva } from "@/lib/auth/dal";

import { ClinicaForm } from "./clinica-form";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesClinicaPage() {
  const org = await getOrgAtiva();

  if (!org) {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  return <ClinicaForm org={org} />;
}
