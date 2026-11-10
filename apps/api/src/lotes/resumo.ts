import {
  avesVivas,
  consolidarSemanas,
  indicadoresDoDia,
  mortalidadeAlta,
  semanaDeVida,
  type ApontamentoDia,
  type FaseLote,
  type LoteResumo,
  type SituacaoLote,
} from "@vocare/shared";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "../db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../db/lotes";
import { hojeISO, noDia } from "../datas";

const SOMAVEIS = [
  "mortasFemeas",
  "mortasMachos",
  "eliminadasFemeas",
  "eliminadasMachos",
  "ovosTotal",
  "ovosIncubaveis",
  "racaoKg",
] as const;

function somarLinhas(data: string, linhas: ApontamentoDia[]): ApontamentoDia {
  const soma: ApontamentoDia = { data, instalacaoId: "" };
  for (const l of linhas) for (const k of SOMAVEIS) if (l[k] != null) soma[k] = (soma[k] ?? 0) + (l[k] as number);
  return soma;
}

export async function listarLotes(orgId: string, filtro: { situacao?: SituacaoLote; id?: string } = {}): Promise<LoteResumo[]> {
  const filtros = [eq(lote.organizationId, orgId)];
  if (filtro.situacao) filtros.push(eq(lote.situacao, filtro.situacao));
  if (filtro.id) filtros.push(eq(lote.id, filtro.id));
  const lotes = await db.select().from(lote).where(and(...filtros)).orderBy(asc(lote.codigo));
  if (lotes.length === 0) return [];
  const ids = lotes.map((l) => l.id);

  const aloj = await db
    .select({
      loteId: alojamento.loteId,
      instalacaoId: alojamento.instalacaoId,
      nome: instalacao.nome,
      inicio: alojamento.inicio,
      fim: alojamento.fim,
      femeas: alojamento.femeas,
      machos: alojamento.machos,
    })
    .from(alojamento)
    .innerJoin(instalacao, eq(instalacao.id, alojamento.instalacaoId))
    .where(inArray(alojamento.loteId, ids))
    .orderBy(asc(instalacao.nome));
  const linhas = await db.select().from(apontamentoAviario).where(inArray(apontamentoAviario.loteId, ids));

  const hoje = hojeISO();
  const ontem = noDia(hoje, -1);
  const num = (v: string | null) => (v === null ? null : Number(v));

  return lotes.map((l) => {
    const dele: ApontamentoDia[] = linhas
      .filter((a) => a.loteId === l.id)
      .map((a) => ({
        data: a.data,
        instalacaoId: a.instalacaoId,
        mortasFemeas: a.mortasFemeas,
        mortasMachos: a.mortasMachos,
        eliminadasFemeas: a.eliminadasFemeas,
        eliminadasMachos: a.eliminadasMachos,
        ovosTotal: a.ovosTotal,
        ovosIncubaveis: a.ovosIncubaveis,
        racaoKg: num(a.racaoKg),
      }));
    const iniciais = { femeas: l.femeasIniciais, machos: l.machosIniciais };
    const alojs = aloj.filter((a) => a.loteId === l.id);
    const abertos = alojs.filter((a) => a.fim === null);
    const galpoes = new Map((l.situacao === "ativo" ? abertos : alojs).map((a) => [a.instalacaoId, a.nome]));

    const doOntem = dele.filter((a) => a.data === ontem);
    const posturaOntemPct =
      doOntem.length === 0 ? null : indicadoresDoDia(somarLinhas(ontem, doOntem), avesVivas(iniciais, dele, noDia(ontem, -1))).posturaPct;

    const semana = semanaDeVida(l.dataAlojamento, l.idadeAlojamentoDias, hoje);
    const mortalidadeSemanaPct = consolidarSemanas(l, dele, []).find((s) => s.semana === semana)?.mortalidadePct ?? null;

    const doHoje = dele.filter((a) => a.data === hoje);
    const semApontamentoHoje =
      l.situacao === "ativo" &&
      abertos.some((a) => a.inicio <= hoje && !doHoje.some((d) => d.instalacaoId === a.instalacaoId));

    // Taxa de cada galpão sobre as aves dele no começo do dia.
    const mortalidadeAltaHoje = doHoje.some((ap) => {
      const a = alojs.find((x) => x.instalacaoId === ap.instalacaoId && x.inicio <= hoje && (x.fim === null || x.fim >= hoje));
      if (!a) return false;
      const antes = dele.filter((d) => d.instalacaoId === a.instalacaoId && d.data >= a.inicio && d.data < hoje);
      return mortalidadeAlta(ap, avesVivas({ femeas: a.femeas, machos: a.machos }, antes, noDia(hoje, -1)));
    });

    return {
      id: l.id,
      codigo: l.codigo,
      linhagem: l.linhagem,
      fase: l.fase as FaseLote,
      situacao: l.situacao as SituacaoLote,
      dataAlojamento: l.dataAlojamento,
      semana,
      galpoes: [...galpoes].map(([id, nome]) => ({ id, nome })),
      vivas: avesVivas(iniciais, dele, hoje),
      posturaOntemPct,
      mortalidadeSemanaPct,
      semApontamentoHoje,
      mortalidadeAltaHoje,
    };
  });
}
