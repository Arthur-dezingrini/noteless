import { Header } from "@/components/app/header";
import { Sidebar } from "@/components/app/sidebar";
import {
  getAnimais,
  getMemberRole,
  getNotificacoes,
  getOcorrencias,
  getOrgAtiva,
  getOrganizations,
  requireSession,
  rotuloPapel,
} from "@/lib/auth/dal";

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

  const [member, ocorrencias, animais, notificacoes] = org
    ? await Promise.all([getMemberRole(org.id), getOcorrencias(org.id), getAnimais(org.id), getNotificacoes(org.id)])
    : [null, [], [], []];
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
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header orgId={org?.id ?? null} notificacoes={notificacoes} />
        <main className="flex-1 px-6 py-7 lg:px-11">{children}</main>
      </div>
    </div>
  );
}
