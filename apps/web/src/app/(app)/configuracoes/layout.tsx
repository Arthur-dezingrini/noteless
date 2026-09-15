import { PageHeader } from "@/components/app/page-header";

import { ConfigNav } from "./config-nav";

export default function ConfiguracoesLayout({ children }: LayoutProps<"/configuracoes">) {
  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie as preferências do sistema"
      />
      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <ConfigNav />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </>
  );
}
