import { Header } from "@/components/app/header";
import { Sidebar } from "@/components/app/sidebar";
import { getOrganizations, requireSession } from "@/lib/auth/dal";

/**
 * Casca da área logada. A sessão é exigida aqui, mas layouts não re-renderizam
 * em navegação entre páginas irmãs — por isso cada página que mostra dados
 * sensíveis continua chamando a DAL por conta própria.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [{ user }, organizations] = await Promise.all([
    requireSession(),
    getOrganizations(),
  ]);

  const orgName = organizations[0]?.name ?? "Sem organização";

  return (
    <div className="flex min-h-svh bg-surface">
      <Sidebar orgName={orgName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
