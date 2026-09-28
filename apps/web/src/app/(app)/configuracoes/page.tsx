import { getOrgAtiva } from "@/lib/auth/dal";

import { ContaForm } from "./conta-form";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesContaPage() {
  const org = await getOrgAtiva();
  if (!org) return <p className="text-[15px] text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>;
  return <ContaForm org={org} />;
}
