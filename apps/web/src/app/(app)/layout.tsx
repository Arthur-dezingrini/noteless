import { AoVivo } from "@/modulos/avisos";
import { Header } from "@/components/app/header";
import { Sidebar } from "@/components/app/sidebar";
import { getMemberRole, getOrgAtiva, getOrganizations, requireSession, rotuloPapel } from "@/lib/auth/dal";
import { getNotificacoes, getNovidades } from "@/modulos/avisos/dados";
import { getAnimais } from "@/modulos/animais/dados";
import { getInstalacoes } from "@/modulos/aviario/dados";
import { getOcorrencias } from "@/modulos/notas/dados";

/**
 * Casca da área logada. A sessão é exigida aqui, mas layouts não re-renderizam
 * em navegação entre páginas irmãs — por isso cada página que mostra dados
 * sensíveis continua chamando a DAL por conta própria.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [{ user }, organizations, org] = await Promise.all([
    requireSession(),
    getOrganizations(),
    getOrgAtiva(),
  ]);

  const [member, ocorrencias, animais, notificacoes, instalacoes, novidades] = org
    ? await Promise.all([
        getMemberRole(org.id),
        getOcorrencias(org.id),
        getAnimais(org.id),
        getNotificacoes(org.id),
        getInstalacoes(org.id),
        getNovidades(org.id),
      ])
    : [null, [], [], [], [], null];
  const pendentes = ocorrencias.filter((o) => o.status === "pendente").length;
  const admin = member?.role === "owner" || member?.role === "admin";

  return (
    <div className="flex min-h-svh bg-page">
      <Sidebar
        organizacoes={organizations}
        ativaId={org?.id ?? null}
        animais={org ? animais.length : null}
        user={user}
        subtitulo={user.cargo || rotuloPapel(member?.role)}
        pendentes={pendentes}
        admin={admin}
        temInstalacao={instalacoes.length > 0}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header orgId={org?.id ?? null} notificacoes={notificacoes} />
        <main className="flex-1 px-6 py-7 lg:px-11">{children}</main>
      </div>
      {/* Ocorrência do gravador, aviso novo: a tela se atualiza sozinha. */}
      {org && <AoVivo orgId={org.id} versao={novidades} />}
    </div>
  );
}
