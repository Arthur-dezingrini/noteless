import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { FichaView } from "@/modulos/animais";
import { getFicha } from "@/modulos/animais/dados";
import { hojeISO } from "@/lib/datas";


type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrgAtiva();
  const ficha = org ? await getFicha(org.id, id) : null;
  return { title: ficha ? ficha.animal.nome || `nº ${ficha.animal.numero}` : "Animal" };
}

export default async function FichaAnimalPage({ params }: Props) {
  const { id } = await params;
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) notFound();

  const [ficha, membro] = await Promise.all([getFicha(org.id, id), getMemberRole(org.id)]);
  if (!ficha) notFound();

  return (
    <FichaView
      orgId={org.id}
      ficha={ficha}
      hoje={hojeISO()}
      possoRemover={membro?.role === "owner" || membro?.role === "admin"}
    />
  );
}
