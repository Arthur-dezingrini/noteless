import { arredondar, diasRestantes, type SaldoProduto } from "@vocare/shared";
import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { hojeISO, noDia } from "../../../base/datas";
import { db } from "../../../db";
import { localEstoque, movimentoEstoque, produto, saldoEstoque } from "../../../db/tabelas/estoque";
import { paraProduto } from "./cadastros";

/**
 * Ração que saiu pelo registro diário nos últimos 7 dias (hoje incluído),
 * sem as saídas estornadas: por local (o silo inteiro, para o aviso de ração
 * acabando) e por produto no local (para a linha de cada ração no saldo).
 */
export async function consumoRacao7Dias(
  orgId: string,
  hoje = hojeISO(),
): Promise<{ porLocal: Map<string, number>; porProdutoNoLocal: Map<string, number> }> {
  const rows = await db
    .select({ localId: movimentoEstoque.localId, produtoId: movimentoEstoque.produtoId, total: sql<string>`sum(-${movimentoEstoque.quantidade})` })
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
    .groupBy(movimentoEstoque.localId, movimentoEstoque.produtoId);
  const porLocal = new Map<string, number>();
  const porProdutoNoLocal = new Map<string, number>();
  for (const r of rows) {
    porLocal.set(r.localId, (porLocal.get(r.localId) ?? 0) + Number(r.total));
    porProdutoNoLocal.set(`${r.localId}|${r.produtoId}`, Number(r.total));
  }
  return { porLocal, porProdutoNoLocal };
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
  const { porProdutoNoLocal } = await consumoRacao7Dias(orgId, hoje);
  const consumoDe = (localId: string, produtoId: string) => porProdutoNoLocal.get(`${localId}|${produtoId}`) ?? 0;

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
        consumoTotal += consumoDe(s.localId, p.id);
      }
      l.quantidade = arredondar(l.quantidade + q, 3);
      if (q !== 0) l.lotes.push({ loteFabricacao: s.loteFabricacao, validade: s.validade, quantidade: q });
      if (q > 0 && s.validade && (!validadeMaisProxima || s.validade < validadeMaisProxima)) validadeMaisProxima = s.validade;
    }

    const locais = [...porLocal.values()].map((l) => ({
      ...l,
      diasRestantes: ehRacao ? diasRestantes(l.quantidade, consumoDe(l.localId, p.id)) : null,
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
