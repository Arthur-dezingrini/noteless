import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { getMemberRole, getOrgAtiva, requireSession, rotuloPapel } from "@/lib/auth/dal";

import { PerfilForm } from "./perfil-form";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const member = org ? await getMemberRole(org.id) : null;

  return (
    <>
      <PageHeader title="Meu perfil" subtitle="Gerencie as informações da sua conta." />
      <Card className="max-w-2xl p-5 sm:p-8">
        <PerfilForm user={user} papel={rotuloPapel(member?.role)} />
      </Card>
    </>
  );
}
