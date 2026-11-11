import { gravadorOnline, type Gravador } from "@vocare/shared";

import { Dot, StatusText } from "@/components/ui";
import { haQuantoTempo } from "@/lib/datas";

/** Online ou "visto há…" — online é ter avisado nos últimos 3 min. */
export function Situacao({ g }: { g: Gravador }) {
  const online = gravadorOnline(g.vistoEm);
  return (
    <span className="flex items-center gap-2">
      <Dot tone={online ? "ok" : "neutro"} />
      {online ? <StatusText tone="ok">Online</StatusText> : <span className="text-ink-muted" suppressHydrationWarning>
          Offline · visto {haQuantoTempo(new Date(g.vistoEm))}
        </span>}
    </span>
  );
}

/** Empresa de destino, ou por que as notas não vão para ela. */
export function Destino({ g }: { g: Gravador }) {
  if (!g.destino) return <StatusText tone="aviso">Sem empresa</StatusText>;
  if (!g.destinoValido)
    return (
      <span>
        {g.destino.nome} <StatusText tone="perigo">· conta não vinculada</StatusText>
      </span>
    );
  return <span className="text-ink">{g.destino.nome}</span>;
}
