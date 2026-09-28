import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";

import { ConfigNav } from "./config-nav";

/** Configurações: dados da conta e quem tem acesso. Só administrador entra. */
export default async function ConfiguracoesLayout({ children }: LayoutProps<"/configuracoes">) {
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const membro = org ? await getMemberRole(org.id) : null;
  const admin = membro?.role === "owner" || membro?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Configurações</h1>
        <p className="text-base text-ink-muted">Dados da conta e quem tem acesso.</p>
      </div>
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
