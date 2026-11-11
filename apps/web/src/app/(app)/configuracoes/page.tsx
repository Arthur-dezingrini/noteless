import { redirect } from "next/navigation";

import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { ContaForm } from "@/modulos/conta";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesContaPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const papel = org ? await getMemberRole(org.id) : null;
  // Super usuário que não administra esta empresa cai direto nos vínculos.
  if (papel?.role !== "owner" && papel?.role !== "admin" && user.tipo === "super") redirect("/configuracoes/vinculos");
  if (!org) return <p className="text-[15px] text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>;
  return <ContaForm org={org} />;
}
