import { notFound } from "next/navigation";

import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { GravadoresLista } from "@/modulos/conta";
import { getGravadores, getGravadoresAdmin, getUsuariosAdmin } from "@/modulos/conta/dados";

export const metadata = { title: "Gravadores" };

/** Gravadores de campo: o super usuário vê e configura todos; o administrador vê os que mandam para a empresa dele. */
export default async function GravadoresPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);

  if (user.tipo === "super") {
    const [gravadores, usuarios] = await Promise.all([getGravadoresAdmin(), getUsuariosAdmin()]);
    const empresasPorConta = Object.fromEntries(usuarios.map((u) => [u.id, u.vinculos.map((v) => ({ id: v.organizationId, nome: v.empresa }))]));
    return <GravadoresLista gravadores={gravadores} empresasPorConta={empresasPorConta} podeMexer />;
  }

  const membro = org ? await getMemberRole(org.id) : null;
  if (!org || (membro?.role !== "owner" && membro?.role !== "admin")) notFound();
  return <GravadoresLista gravadores={await getGravadores(org.id)} empresasPorConta={{}} podeMexer={false} />;
}
