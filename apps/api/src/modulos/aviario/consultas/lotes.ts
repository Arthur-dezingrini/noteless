import { avesVivas, type ApontamentoDia } from "@vocare/shared";
import { and, eq, lt } from "drizzle-orm";

import { db } from "../../../db";
import { apontamentoAviario, lote } from "../../../db/tabelas/aviario";

/** Lote da organização, ou `null`. */
export async function acharLote(orgId: string, id: string) {
  const [l] = await db.select().from(lote).where(and(eq(lote.id, id), eq(lote.organizationId, orgId)));
  return l ?? null;
}

/** Aves vivas do lote no começo do dia `data` (alojadas menos as baixas apontadas antes). */
export async function avesVivasNoDia(alvo: typeof lote.$inferSelect, data: string, leitor: Pick<typeof db, "select"> = db): Promise<number> {
  const rows = await leitor
    .select({
      data: apontamentoAviario.data,
      instalacaoId: apontamentoAviario.instalacaoId,
      mortasFemeas: apontamentoAviario.mortasFemeas,
      mortasMachos: apontamentoAviario.mortasMachos,
      eliminadasFemeas: apontamentoAviario.eliminadasFemeas,
      eliminadasMachos: apontamentoAviario.eliminadasMachos,
    })
    .from(apontamentoAviario)
    .where(and(eq(apontamentoAviario.loteId, alvo.id), lt(apontamentoAviario.data, data)));
  const vivas = avesVivas({ femeas: alvo.femeasIniciais, machos: alvo.machosIniciais }, rows as ApontamentoDia[], data);
  return Math.max(vivas.femeas + vivas.machos, 0);
}
