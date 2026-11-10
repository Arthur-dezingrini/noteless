import { notFound } from "next/navigation";

import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth/dal";
import { BRAND_NAME } from "@/lib/brand";
import { acharAtivo } from "@/lib/navigation";

export const metadata = { title: "Em breve" };

/** Tela ou módulo que ainda não existe: o menu já mostra, esta página avisa. */
export default async function EmBrevePage({ searchParams }: PageProps<"/em-breve">) {
  const [, { tela }] = await Promise.all([requireSession(), searchParams]);
  const ativo = acharAtivo("/em-breve", typeof tela === "string" ? tela : null);
  if (!ativo) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={ativo.tela ? ativo.modulo.rotulo : undefined} title={ativo.tela?.rotulo ?? ativo.modulo.rotulo} />
      <Card padded className="text-[15px] text-ink-muted">
        Esta parte do {BRAND_NAME} ainda está sendo construída.
      </Card>
    </div>
  );
}
