import { notFound } from "next/navigation";

import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { FirmwareLista, GravadoresLista, LinkAvisoGravador } from "@/modulos/conta";
import { getEmpresas, getFirmwares, getGravadores, getGravadoresAdmin } from "@/modulos/conta/dados";

export const metadata = { title: "Gravadores" };

/** Gravadores de campo: o super usuário vê, aprova e configura todos; o administrador vê os que mandam para a empresa dele. */
export default async function GravadoresPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);

  if (user.tipo === "super") {
    const [gravadores, empresas, firmwares] = await Promise.all([getGravadoresAdmin(), getEmpresas(), getFirmwares()]);
    return (
      <>
        <LinkAvisoGravador />
        <GravadoresLista gravadores={gravadores} empresas={empresas} firmwares={firmwares} podeMexer />
        <FirmwareLista firmwares={firmwares} />
      </>
    );
  }

  const membro = org ? await getMemberRole(org.id) : null;
  if (!org || (membro?.role !== "owner" && membro?.role !== "admin")) notFound();
  return (
    <>
      <LinkAvisoGravador />
      <GravadoresLista gravadores={await getGravadores(org.id)} empresas={[]} podeMexer={false} />
    </>
  );
}
