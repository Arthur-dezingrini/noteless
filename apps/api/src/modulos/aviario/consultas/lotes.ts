import { and, eq } from "drizzle-orm";

import { db } from "../../../db";
import { lote } from "../../../db/tabelas/aviario";

/** Lote da organização, ou `null`. */
export async function acharLote(orgId: string, id: string) {
  const [l] = await db.select().from(lote).where(and(eq(lote.id, id), eq(lote.organizationId, orgId)));
  return l ?? null;
}
