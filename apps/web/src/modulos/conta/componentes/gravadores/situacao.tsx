import { gravadorOnline, type Gravador } from "@vocare/shared";

import { Dot, StatusText } from "@/components/ui";
import { haQuantoTempo } from "@/lib/datas";

/** "Ativo" se avisou nos últimos 20 min (ela avisa a cada 15); senão, "sem contato". Antes disso, aguardando aprovação. */
export function Situacao({ g }: { g: Gravador }) {
  const ativo = gravadorOnline(g.vistoEm);
  return (
    <span className="flex items-center gap-2">
      <Dot tone={!g.aprovado ? "aviso" : ativo ? "ok" : "neutro"} />
      <span suppressHydrationWarning>
        {!g.aprovado ? (
          <StatusText tone="aviso">Aguardando aprovação</StatusText>
        ) : ativo ? (
          <StatusText tone="ok">Ativo</StatusText>
        ) : (
          <span className="text-ink-muted">Sem contato</span>
        )}
        <span className="text-ink-muted"> · {haQuantoTempo(new Date(g.vistoEm))}</span>
      </span>
    </span>
  );
}

/** Empresa de destino, ou por que as notas não vão para ela. */
export function Destino({ g }: { g: Gravador }) {
  if (!g.aprovado) return <span className="text-ink-muted">—</span>;
  if (!g.destino) return <StatusText tone="aviso">Sem empresa</StatusText>;
  return <span className="text-ink">{g.destino.nome}</span>;
}
