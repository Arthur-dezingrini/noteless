import { Construction } from "lucide-react";

import { PageHeader } from "./page-header";

/** Placeholder das telas ainda não desenhadas, pra navegação não dar 404. */
export function EmBreve({ titulo }: { titulo: string }) {
  return (
    <>
      <PageHeader title={titulo} />
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white px-6 py-20 text-center">
        <Construction className="size-8 text-ink-muted/60" />
        <p className="mt-4 text-sm font-medium text-ink">Tela em construção</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Esta área ainda não foi desenhada. O menu já está no lugar para a
          navegação fazer sentido.
        </p>
      </div>
    </>
  );
}
