import type { GalpaoHoje } from "@vocare/shared";
import Link from "next/link";

import { Card, Dot, SectionHeader } from "@/components/ui";

/** Bloco do início: galpões com lote alojado e se já foram apontados hoje. */
export function GalpoesHoje({ galpoes }: { galpoes: GalpaoHoje[] }) {
  if (galpoes.length === 0) return null;
  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeader title="Galpões hoje" />
      <Card>
        {galpoes.map((g, i) => (
          <div key={g.instalacaoId} className={`flex items-center gap-4 px-5 py-3.5 ${i ? "border-t border-line" : ""}`}>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Link href={`/aviario/lotes/${g.loteId}`} className="truncate text-[15px] font-semibold text-ink no-underline hover:underline">
                {g.nome}
              </Link>
              <span className="truncate text-sm text-ink-muted">Lote {g.loteCodigo}</span>
            </span>
            <span className="flex items-center gap-2 text-[15px] text-ink">
              <Dot tone={g.apontado ? "ok" : "aviso"} />
              {g.apontado ? "Apontado" : "Sem apontamento"}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}
