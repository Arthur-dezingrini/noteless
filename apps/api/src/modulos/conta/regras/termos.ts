import { aceitarTermosSchema } from "@vocare/shared";
import { and, eq } from "drizzle-orm";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { aceiteTermos } from "../../../db/tabelas/conta";

/** Quando a pessoa aceitou esta versão dos termos; `null` se ainda não aceitou. */
export async function aceiteDaVersao(userId: string, versao: string): Promise<Date | null> {
  const [linha] = await db
    .select({ aceitoEm: aceiteTermos.aceitoEm })
    .from(aceiteTermos)
    .where(and(eq(aceiteTermos.userId, userId), eq(aceiteTermos.versao, versao)));
  return linha?.aceitoEm ?? null;
}

/** Registra o aceite da versão atual. Aceitar de novo mantém o primeiro registro. */
export async function aceitarTermos(userId: string, entrada: unknown, ip: string | null): Promise<Resultado<{ aceitoEm: Date }>> {
  const dados = aceitarTermosSchema.safeParse(entrada);
  if (!dados.success) return falha(400, dados.error.issues[0]?.message ?? "Dados inválidos.");
  await db.insert(aceiteTermos).values({ userId, versao: dados.data.versao, ip }).onConflictDoNothing();
  const aceitoEm = await aceiteDaVersao(userId, dados.data.versao);
  if (!aceitoEm) throw new Error("O aceite dos termos não ficou gravado.");
  return ok({ aceitoEm });
}
