import { Header } from "@/components/app/header";
import { Sidebar } from "@/components/app/sidebar";
import {
  getMemberRole,
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

  const member = org ? await getMemberRole(org.id) : null;

  return (
    <div className="flex min-h-svh bg-surface">
      <Sidebar organizacoes={organizations} ativaId={org?.id ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} papel={rotuloPapel(member?.role)} />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
