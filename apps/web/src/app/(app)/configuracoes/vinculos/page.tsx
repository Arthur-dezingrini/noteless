import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth/dal";
import { VinculosLista } from "@/modulos/conta";
import { getEmpresas, getUsuariosAdmin } from "@/modulos/conta/dados";

export const metadata = { title: "Vínculos" };

/** Quem está em qual empresa, na plataforma inteira. Só super usuário. */
export default async function VinculosPage({ searchParams }: PageProps<"/configuracoes/vinculos">) {
  const [{ user }, { busca }] = await Promise.all([requireSession(), searchParams]);
  if (user.tipo !== "super") notFound();
  const termo = typeof busca === "string" ? busca : "";
  const [usuarios, empresas] = await Promise.all([getUsuariosAdmin(termo), getEmpresas()]);
  return <VinculosLista usuarios={usuarios} empresas={empresas} busca={termo} meuId={user.id} />;
}
