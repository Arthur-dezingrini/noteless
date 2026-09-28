import { Header } from "@/components/app/header";
import { Sidebar } from "@/components/app/sidebar";
import {
  getMemberRole,
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

  const [member, ocorrencias] = org
    ? await Promise.all([getMemberRole(org.id), getOcorrencias(org.id)])
    : [null, []];
  const pendentes = ocorrencias.filter((o) => o.status === "pendente").length;

  return (
    <div className="flex min-h-svh bg-page">
      <Sidebar
        organizacoes={organizations}
        ativaId={org?.id ?? null}
        user={user}
        papel={rotuloPapel(member?.role)}
        pendentes={pendentes}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Notificações ainda não existem na api (etapa 6): sino sem contagem. */}
        <Header naoLidas={0} />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
