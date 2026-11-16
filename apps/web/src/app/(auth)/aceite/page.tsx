import { TERMOS_EM_VIGOR } from "@vocare/shared";
import { redirect } from "next/navigation";

import { Logo } from "@/components/auth/logo";
import { requireSession } from "@/lib/auth/dal";
import { AceiteForm, versaoParaAceitar } from "@/modulos/conta";
import { getAceite } from "@/modulos/conta/dados";

export const metadata = { title: "Termos de Uso" };

/** Antes de entrar: aceitar os Termos de Uso e a Política de Privacidade da versão atual. Fica fora de (app) para não cair em laço. */
export default async function AceitePage() {
  await requireSession();
  if (!TERMOS_EM_VIGOR) redirect("/dashboard");
  const aceite = await getAceite();
  if (aceite?.aceitoEm) redirect("/dashboard");

  return (
    <main className="flex min-h-svh items-center justify-center bg-page px-6 py-12">
      <div className="flex w-full max-w-[26rem] flex-col gap-7">
        <Logo />
        <AceiteForm versao={versaoParaAceitar(aceite)} />
      </div>
    </main>
  );
}
