import { DIAS_AUDIO } from "@vocare/shared";
import { and, eq, inArray, lt } from "drizzle-orm";

import { db } from "../../../db";
import { ocorrencia, ocorrenciaAudio } from "../../../db/tabelas/notas";

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Apaga o áudio das notas confirmadas ou descartadas há mais de DIAS_AUDIO
 * dias (contados da revisão) e marca quando. Transcrição e registros ficam.
 * Nota pendente, inclusive a restaurada, não é tocada. Vale para todas as
 * empresas; quem chama é a rotina diária. Devolve quantas notas perderam o áudio.
 */
export async function apagarAudiosVencidos(agora: Date, limite = 1000): Promise<number> {
  const corte = new Date(agora.getTime() - DIAS_AUDIO * DIA_MS);
  return db.transaction(async (tx) => {
    const vencidas = await tx
      .select({ id: ocorrencia.id })
      .from(ocorrencia)
      .innerJoin(ocorrenciaAudio, eq(ocorrenciaAudio.ocorrenciaId, ocorrencia.id))
      .where(and(inArray(ocorrencia.status, ["confirmada", "descartada"]), lt(ocorrencia.revisadoEm, corte)))
      .limit(limite);
    const ids = vencidas.map((v) => v.id);
    if (ids.length === 0) return 0;
    await tx.delete(ocorrenciaAudio).where(inArray(ocorrenciaAudio.ocorrenciaId, ids));
    await tx.update(ocorrencia).set({ audioApagadoEm: agora }).where(inArray(ocorrencia.id, ids));
    return ids.length;
  });
}
