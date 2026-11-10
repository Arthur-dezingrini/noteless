import { Card } from "@/components/ui";
import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { GruposView } from "@/modulos/animais";
import { getAnimais, getGrupos } from "@/modulos/animais/dados";


export const metadata = { title: "Grupos" };

export default async function GruposPage() {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) {
    return (
      <Card padded className="text-[15px] text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const [grupos, animais, membro] = await Promise.all([getGrupos(org.id), getAnimais(org.id), getMemberRole(org.id)]);
  return (
    <GruposView
      orgId={org.id}
      grupos={grupos}
      animais={animais}
      possoRemover={membro?.role === "owner" || membro?.role === "admin"}
    />
  );
}
