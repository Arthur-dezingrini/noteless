import type { GalpaoHoje, Instalacao } from "@vocare/shared";
import { and, asc, eq, isNull } from "drizzle-orm";

import { hojeISO } from "../../../base/datas";
import { db } from "../../../db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../../../db/tabelas/aviario";

/** Instalações da organização (ou só `id`), com o lote alojado agora. */
export async function listarInstalacoes(orgId: string, id?: string): Promise<Instalacao[]> {
  const filtros = [eq(instalacao.organizationId, orgId)];
  if (id) filtros.push(eq(instalacao.id, id));
  const linhas = await db
    .select({
      id: instalacao.id,
      nome: instalacao.nome,
      tipo: instalacao.tipo,
      capacidade: instalacao.capacidade,
      areaM2: instalacao.areaM2,
      ativa: instalacao.ativa,
      loteId: lote.id,
      loteCodigo: lote.codigo,
    })
    .from(instalacao)
    .leftJoin(alojamento, and(eq(alojamento.instalacaoId, instalacao.id), isNull(alojamento.fim)))
    .leftJoin(lote, eq(lote.id, alojamento.loteId))
    .where(and(...filtros))
    .orderBy(asc(instalacao.nome));
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo as Instalacao["tipo"],
    capacidade: l.capacidade,
    areaM2: l.areaM2 === null ? null : Number(l.areaM2),
    ativa: l.ativa,
    loteAtual: l.loteId && l.loteCodigo ? { id: l.loteId, codigo: l.loteCodigo } : null,
  }));
}

/** Galpões com lote alojado e se já têm apontamento de hoje — o bloco do início. */
export async function listarGalpoesHoje(orgId: string): Promise<GalpaoHoje[]> {
  const hoje = hojeISO();
  const linhas = await db
    .select({
      instalacaoId: instalacao.id,
      nome: instalacao.nome,
      loteId: lote.id,
      loteCodigo: lote.codigo,
      apontamentoId: apontamentoAviario.id,
    })
    .from(instalacao)
    .innerJoin(alojamento, and(eq(alojamento.instalacaoId, instalacao.id), isNull(alojamento.fim)))
    .innerJoin(lote, eq(lote.id, alojamento.loteId))
    .leftJoin(
      apontamentoAviario,
      and(eq(apontamentoAviario.instalacaoId, instalacao.id), eq(apontamentoAviario.data, hoje)),
    )
    .where(eq(instalacao.organizationId, orgId))
    .orderBy(asc(instalacao.nome));
  return linhas.map((l) => ({
    instalacaoId: l.instalacaoId,
    nome: l.nome,
    loteId: l.loteId,
    loteCodigo: l.loteCodigo,
    apontado: l.apontamentoId !== null,
  }));
}
