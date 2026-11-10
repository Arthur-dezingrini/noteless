import { Card } from "@/components/ui";
import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { AnimaisLista } from "@/modulos/animais";
import { getAnimais } from "@/modulos/animais/dados";


export const metadata = { title: "Animais" };

export default async function AnimaisPage() {
  await requireSession();
  const org = await getOrgAtiva();

  if (!org) {
    return (
      <Card padded>
        <p className="text-sm text-ink-muted">Você ainda não faz parte de nenhuma organização.</p>
      </Card>
    );
  }

  const [animais, membro] = await Promise.all([getAnimais(org.id), getMemberRole(org.id)]);
  const possoRemover = membro?.role === "owner" || membro?.role === "admin";

  return <AnimaisLista orgId={org.id} animais={animais} possoRemover={possoRemover} />;
}
