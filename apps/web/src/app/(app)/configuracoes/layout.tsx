import { PageHeader } from "@/components/ui";
import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { ConfigNav } from "./config-nav";

/** Configurações: dados da conta e quem tem acesso. Só administrador entra. */
export default async function ConfiguracoesLayout({ children }: LayoutProps<"/configuracoes">) {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const membro = org ? await getMemberRole(org.id) : null;
  const admin = membro?.role === "owner" || membro?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Dados da conta e quem tem acesso." />
      {admin ? (
        <>
          <ConfigNav />
          <div className="min-w-0">{children}</div>
        </>
      ) : (
        <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Só administradores mexem nas configurações da conta. Se precisar mudar algo, fale com um administrador.
        </p>
      )}
    </div>
  );
}
