import { avesVivas, semanaDeVida } from "@vocare/shared";
import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import { db } from "../db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../db/tabelas/aviario";
import type { GalpaoParaIa } from "../ia/analisar";

/** Galpões com lote ativo alojado em `hoje` — o contexto para "apontei o galpão 3", "pesei o lote 7". */
export async function galpoesDaOrg(orgId: string, hoje: string): Promise<GalpaoParaIa[]> {
  const aloj = await db
    .select({
      instalacaoId: alojamento.instalacaoId,
      nome: instalacao.nome,
      loteId: lote.id,
      loteCodigo: lote.codigo,
      dataAlojamento: lote.dataAlojamento,
      idadeAlojamentoDias: lote.idadeAlojamentoDias,
      inicio: alojamento.inicio,
      femeas: alojamento.femeas,
      machos: alojamento.machos,
    })
    .from(alojamento)
    .innerJoin(lote, eq(lote.id, alojamento.loteId))
    .innerJoin(instalacao, eq(instalacao.id, alojamento.instalacaoId))
    .where(
      and(
        eq(alojamento.organizationId, orgId),
        eq(lote.situacao, "ativo"),
        lte(alojamento.inicio, hoje),
        or(isNull(alojamento.fim), gte(alojamento.fim, hoje)),
      ),
    )
    .orderBy(asc(instalacao.nome));
  if (aloj.length === 0) return [];

  const aps = await db
    .select()
    .from(apontamentoAviario)
    .where(
      and(
        eq(apontamentoAviario.organizationId, orgId),
        inArray(apontamentoAviario.instalacaoId, aloj.map((a) => a.instalacaoId)),
        lte(apontamentoAviario.data, hoje),
      ),
    );

  return aloj.map((a) => {
    const baixas = aps
      .filter((p) => p.instalacaoId === a.instalacaoId && p.loteId === a.loteId && p.data >= a.inicio)
      .map((p) => ({
        data: p.data,
        instalacaoId: p.instalacaoId,
        mortasFemeas: p.mortasFemeas,
        mortasMachos: p.mortasMachos,
        eliminadasFemeas: p.eliminadasFemeas,
        eliminadasMachos: p.eliminadasMachos,
      }));
    const vivas = avesVivas({ femeas: a.femeas, machos: a.machos }, baixas, hoje);
    return {
      instalacaoId: a.instalacaoId,
      nome: a.nome,
      loteId: a.loteId,
      loteCodigo: a.loteCodigo,
      semana: semanaDeVida(a.dataAlojamento, a.idadeAlojamentoDias, hoje),
      femeas: vivas.femeas,
      machos: vivas.machos,
    };
  });
}
