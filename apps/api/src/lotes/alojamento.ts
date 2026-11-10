import { and, eq, gte, isNull, lte, ne, or } from "drizzle-orm";

import { db } from "../db";
import { alojamento, instalacao, lote } from "../db/lotes";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Lote alojado na instalação em `data` ("AAAA-MM-DD"), ou `null` se estava vazia. */
export async function loteNaData(tx: Tx | typeof db, orgId: string, instalacaoId: string, data: string) {
  const [achado] = await tx
    .select({ loteId: lote.id, situacao: lote.situacao, dataEncerramento: lote.dataEncerramento })
    .from(alojamento)
    .innerJoin(lote, eq(lote.id, alojamento.loteId))
    .where(
      and(
        eq(alojamento.organizationId, orgId),
        eq(alojamento.instalacaoId, instalacaoId),
        lte(alojamento.inicio, data),
        or(isNull(alojamento.fim), gte(alojamento.fim, data)),
      ),
    )
    .limit(1);
  if (!achado) return null;
  return {
    loteId: achado.loteId,
    situacao: achado.situacao as "ativo" | "encerrado",
    dataEncerramento: achado.dataEncerramento,
  };
}

/** Algum alojamento da instalação cruza `[inicio, fim ?? ∞]`? `ignorarId` deixa de fora um alojamento (ao editá-lo). */
export async function sobrepoe(
  tx: Tx | typeof db,
  instalacaoId: string,
  inicio: string,
  fim: string | null,
  ignorarId?: string,
): Promise<boolean> {
  const filtros = [
    eq(alojamento.instalacaoId, instalacaoId),
    or(isNull(alojamento.fim), gte(alojamento.fim, inicio)),
  ];
  if (fim !== null) filtros.push(lte(alojamento.inicio, fim));
  if (ignorarId) filtros.push(ne(alojamento.id, ignorarId));
  const [achado] = await tx
    .select({ id: alojamento.id })
    .from(alojamento)
    .where(and(...filtros))
    .limit(1);
  return !!achado;
}

/** Garante que a instalação existe nesta organização; devolve o nome ou `null`. */
export async function nomeDaInstalacao(tx: Tx | typeof db, orgId: string, instalacaoId: string) {
  const [i] = await tx
    .select({ nome: instalacao.nome })
    .from(instalacao)
    .where(and(eq(instalacao.id, instalacaoId), eq(instalacao.organizationId, orgId)));
  return i?.nome ?? null;
}
