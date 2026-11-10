import { CAMPOS_APONTAMENTO, CLASSES_OVO, type CampoApontamento, type valoresApontamentoSchema } from "@vocare/shared";
import { and, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import type { z } from "zod";

import { br, hojeISO } from "../base/datas";
import { db } from "../db";
import { alojamento, apontamentoAviario, lote } from "../db/tabelas/aviario";
import { loteNaData, nomeDaInstalacao, type Tx } from "./alojamento";

export type ValoresApontamento = z.infer<typeof valoresApontamentoSchema>;
type Origem = { organizationId: string; criadoPorId: string | null; ocorrenciaId: string | null };

const NUMERICOS: CampoApontamento[] = ["racaoKg", "aguaL"];
const colunas = getTableColumns(apontamentoAviario);

/** Valor como o Drizzle espera na coluna (`numeric` é texto). */
function paraColuna(campo: CampoApontamento, v: number | null | undefined) {
  if (v == null) return null;
  return NUMERICOS.includes(campo) ? String(v) : v;
}

/**
 * Confere se o galpão pode receber o apontamento. Devolve o lote do dia ou a
 * mensagem do que está errado. Em "somar", confere já com o que existe somado.
 */
export async function validarApontamento(
  tx: Tx | typeof db,
  orgId: string,
  instalacaoId: string,
  data: string,
  valores: ValoresApontamento,
  modo: "somar" | "substituir",
): Promise<{ loteId: string } | string> {
  if (data > hojeISO()) return "Data no futuro.";
  const nome = (await nomeDaInstalacao(tx, orgId, instalacaoId)) ?? "galpão";

  const achado = await loteNaData(tx, orgId, instalacaoId, data);
  if (!achado) {
    // Galpão vazio: se o último lote saiu por encerramento, diz isso.
    const [ultimo] = await tx
      .select({ codigo: lote.codigo, situacao: lote.situacao, dataEncerramento: lote.dataEncerramento })
      .from(alojamento)
      .innerJoin(lote, eq(lote.id, alojamento.loteId))
      .where(and(eq(alojamento.organizationId, orgId), eq(alojamento.instalacaoId, instalacaoId), lt(alojamento.fim, data)))
      .orderBy(desc(alojamento.fim))
      .limit(1);
    if (ultimo?.situacao === "encerrado" && ultimo.dataEncerramento && ultimo.dataEncerramento < data) {
      return `O lote ${ultimo.codigo} foi encerrado em ${br(ultimo.dataEncerramento)}.`;
    }
    return `Galpão ${nome} não tem lote alojado em ${br(data)}. Aloje o lote ou corrija o galpão.`;
  }
  if (achado.situacao === "encerrado" && achado.dataEncerramento && achado.dataEncerramento < data) {
    const [l] = await tx.select({ codigo: lote.codigo }).from(lote).where(eq(lote.id, achado.loteId));
    return `O lote ${l?.codigo} foi encerrado em ${br(achado.dataEncerramento)}.`;
  }

  const [aloj] = await tx
    .select({ inicio: alojamento.inicio, femeas: alojamento.femeas, machos: alojamento.machos })
    .from(alojamento)
    .where(
      and(
        eq(alojamento.instalacaoId, instalacaoId),
        eq(alojamento.loteId, achado.loteId),
        lte(alojamento.inicio, data),
        or(isNull(alojamento.fim), gte(alojamento.fim, data)),
      ),
    )
    .limit(1);
  if (!aloj) return `Galpão ${nome} não tem lote alojado em ${br(data)}. Aloje o lote ou corrija o galpão.`;

  const linhas = await tx
    .select()
    .from(apontamentoAviario)
    .where(and(eq(apontamentoAviario.instalacaoId, instalacaoId), gte(apontamentoAviario.data, aloj.inicio), lte(apontamentoAviario.data, data)));
  const n = (v: number | null | undefined) => v ?? 0;
  let baixasF = 0;
  let baixasM = 0;
  let existente: (typeof linhas)[number] | undefined;
  for (const l of linhas) {
    if (l.data === data) {
      existente = l;
      continue;
    }
    baixasF += n(l.mortasFemeas) + n(l.eliminadasFemeas);
    baixasM += n(l.mortasMachos) + n(l.eliminadasMachos);
  }
  const vivasF = aloj.femeas - baixasF;
  const vivasM = aloj.machos - baixasM;

  // Valores do dia como ficarão depois da gravação.
  const resultado = (campo: CampoApontamento): number | null => {
    const novo = valores[campo] ?? null;
    if (modo === "substituir") return novo;
    const antigo = existente ? (existente[campo] == null ? null : Number(existente[campo])) : null;
    return novo == null ? antigo : n(antigo) + novo;
  };

  if (
    n(resultado("mortasFemeas")) + n(resultado("eliminadasFemeas")) > vivasF ||
    n(resultado("mortasMachos")) + n(resultado("eliminadasMachos")) > vivasM
  ) {
    return `Mais aves mortas e eliminadas do que aves vivas no ${nome}.`;
  }
  const total = resultado("ovosTotal");
  if (total != null && CLASSES_OVO.reduce((s, k) => s + n(resultado(k)), 0) > total) {
    return "A soma das classes de ovo passa do total.";
  }
  return { loteId: achado.loteId };
}

function linhaNova(origem: Origem, instalacaoId: string, loteId: string, data: string, valores: ValoresApontamento) {
  const linha: Record<string, unknown> = {
    organizationId: origem.organizationId,
    criadoPorId: origem.criadoPorId,
    ocorrenciaId: origem.ocorrenciaId,
    instalacaoId,
    loteId,
    data,
    observacoes: valores.observacoes ?? null,
  };
  for (const c of CAMPOS_APONTAMENTO) linha[c] = paraColuna(c, valores[c]);
  return linha as typeof apontamentoAviario.$inferInsert;
}

/** Soma ao que já existe no dia; campo ausente em `valores` não mexe no que está gravado. */
export async function somarApontamento(
  tx: Tx | typeof db,
  origem: Origem,
  instalacaoId: string,
  loteId: string,
  data: string,
  valores: ValoresApontamento,
): Promise<void> {
  const set: Record<string, unknown> = {};
  for (const c of CAMPOS_APONTAMENTO) {
    const atual = sql.raw(`"apontamento_aviario"."${colunas[c].name}"`);
    const novo = sql.raw(`excluded."${colunas[c].name}"`);
    set[c] = sql`CASE WHEN ${novo} IS NULL THEN ${atual} ELSE coalesce(${atual}, 0) + ${novo} END`;
  }
  set.observacoes = sql`CASE WHEN excluded."observacoes" IS NULL THEN "apontamento_aviario"."observacoes" WHEN "apontamento_aviario"."observacoes" IS NULL THEN excluded."observacoes" ELSE "apontamento_aviario"."observacoes" || E'\n' || excluded."observacoes" END`;
  await tx
    .insert(apontamentoAviario)
    .values(linhaNova(origem, instalacaoId, loteId, data, valores))
    .onConflictDoUpdate({ target: [apontamentoAviario.instalacaoId, apontamentoAviario.data], set });
}

/** Grava o dia exatamente como veio: campo `null` ou ausente limpa o que existia. */
export async function substituirApontamento(
  tx: Tx | typeof db,
  origem: Origem,
  instalacaoId: string,
  loteId: string,
  data: string,
  valores: ValoresApontamento,
): Promise<void> {
  const { organizationId, criadoPorId, ocorrenciaId, instalacaoId: _i, data: _d, ...set } = linhaNova(origem, instalacaoId, loteId, data, valores);
  await tx
    .insert(apontamentoAviario)
    .values(linhaNova(origem, instalacaoId, loteId, data, valores))
    .onConflictDoUpdate({ target: [apontamentoAviario.instalacaoId, apontamentoAviario.data], set });
}
