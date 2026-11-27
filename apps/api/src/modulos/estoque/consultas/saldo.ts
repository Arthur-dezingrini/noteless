import { arredondar, diasRestantes, type SaldoProduto } from "@vocare/shared";
import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { hojeISO, noDia } from "../../../base/datas";
import { db } from "../../../db";
import { localEstoque, movimentoEstoque, produto, saldoEstoque } from "../../../db/tabelas/estoque";
import { paraProduto } from "./cadastros";

/**
 * Ração que saiu pelo registro diário nos últimos 7 dias (hoje incluído),
 * por local, sem as saídas estornadas. É a base do "dura X dias".
 */
export async function consumoRacao7Dias(orgId: string, hoje = hojeISO()): Promise<Map<string, number>> {
  const rows = await db
    .select({ localId: movimentoEstoque.localId, total: sql<string>`sum(-${movimentoEstoque.quantidade})` })
    .from(movimentoEstoque)
    .where(
      and(
        eq(movimentoEstoque.organizationId, orgId),
        eq(movimentoEstoque.tipo, "saida"),
        eq(movimentoEstoque.origemTipo, "apontamento_aviario"),
        gte(movimentoEstoque.data, noDia(hoje, -6)),
        lte(movimentoEstoque.data, hoje),
        sql`not exists (select 1 from "movimento_estoque" as e where e."estorna_id" = "movimento_estoque"."id")`,
      ),
    )
    .groupBy(movimentoEstoque.localId);
  return new Map(rows.map((r) => [r.localId, Number(r.total)]));
}

/** Saldo de cada produto ativo: total, por local e lote, dias restantes (ração) e validade mais próxima. */
export async function saldoDaOrg(
  orgId: string,
  verCusto: boolean,
  filtro: { categoria?: string; localId?: string } = {},
  hoje = hojeISO(),
): Promise<SaldoProduto[]> {
  const wp: SQL[] = [eq(produto.organizationId, orgId), eq(produto.ativo, true)];
  if (filtro.categoria) wp.push(eq(produto.categoria, filtro.categoria));
  const produtos = await db.select().from(produto).where(and(...wp)).orderBy(asc(produto.nome));

  const ws: SQL[] = [eq(saldoEstoque.organizationId, orgId)];
  if (filtro.localId) ws.push(eq(saldoEstoque.localId, filtro.localId));
  const saldos = await db
    .select({ s: saldoEstoque, localNome: localEstoque.nome })
    .from(saldoEstoque)
    .innerJoin(localEstoque, eq(localEstoque.id, saldoEstoque.localId))
    .where(and(...ws))
    .orderBy(asc(localEstoque.nome), asc(saldoEstoque.validade));
  const consumo = await consumoRacao7Dias(orgId, hoje);

  return produtos.map((p) => {
    const ehRacao = p.categoria === "racao";
    const porLocal = new Map<string, SaldoProduto["porLocal"][number]>();
    let validadeMaisProxima: string | null = null;
    let consumoTotal = 0;

    for (const { s, localNome } of saldos.filter((x) => x.s.produtoId === p.id)) {
      const q = Number(s.quantidade);
      let l = porLocal.get(s.localId);
      if (!l) {
        l = { localId: s.localId, localNome, quantidade: 0, diasRestantes: null, lotes: [] };
        porLocal.set(s.localId, l);
        consumoTotal += consumo.get(s.localId) ?? 0;
      }
      l.quantidade = arredondar(l.quantidade + q, 3);
      if (q !== 0) l.lotes.push({ loteFabricacao: s.loteFabricacao, validade: s.validade, quantidade: q });
      if (q > 0 && s.validade && (!validadeMaisProxima || s.validade < validadeMaisProxima)) validadeMaisProxima = s.validade;
    }

    const locais = [...porLocal.values()].map((l) => ({
      ...l,
      diasRestantes: ehRacao ? diasRestantes(l.quantidade, consumo.get(l.localId) ?? 0) : null,
    }));
    const total = arredondar(
      locais.reduce((t, l) => t + l.quantidade, 0),
      3,
    );
    return {
      produto: paraProduto(p, verCusto),
      total,
      porLocal: locais,
      diasRestantes: ehRacao ? diasRestantes(total, consumoTotal) : null,
      validadeMaisProxima,
    };
  });
}
