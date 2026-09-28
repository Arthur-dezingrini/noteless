import { getMemberRole, getOrgAtiva, requireSession, rotuloPapel } from "@/lib/auth/dal";

import { PerfilForm } from "./perfil-form";

export const metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const member = org ? await getMemberRole(org.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Meu perfil</h1>
        <p className="text-base text-ink-muted">Como os outros veem você no sistema.</p>
      </div>
      <PerfilForm user={user} papel={rotuloPapel(member?.role) || "Membro"} />
    </div>
  );
}
