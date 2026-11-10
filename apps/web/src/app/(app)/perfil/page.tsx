import { PageHeader } from "@/components/ui";
import { getMemberRole, getOrgAtiva, requireSession, rotuloPapel } from "@/lib/auth/dal";

import { PerfilForm } from "./perfil-form";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const member = org ? await getMemberRole(org.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meu perfil" description="Como os outros veem você no sistema." />
      <PerfilForm user={user} papel={rotuloPapel(member?.role) || "Membro"} />
    </div>
  );
}
