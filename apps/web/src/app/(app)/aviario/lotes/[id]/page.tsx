import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { hojeISO } from "@/lib/datas";
import { FichaLote } from "@/modulos/aviario";
import { getInstalacoes, getLote } from "@/modulos/aviario/dados";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrgAtiva();
  const ficha = org ? await getLote(org.id, id) : null;
  return { title: ficha ? `Lote ${ficha.lote.codigo}` : "Lote" };
}

export default async function FichaLotePage({ params }: Props) {
  const { id } = await params;
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) notFound();

  const [ficha, instalacoes, membro] = await Promise.all([getLote(org.id, id), getInstalacoes(org.id), getMemberRole(org.id)]);
  if (!ficha) notFound();

  return (
    <FichaLote
      orgId={org.id}
      ficha={ficha}
      instalacoes={instalacoes}
      hoje={hojeISO()}
      possoGerenciar={membro?.role === "owner" || membro?.role === "admin"}
    />
  );
}
