import { arredondar, repartirFefo, ROTULO_CATEGORIA_PRODUTO, type CategoriaProduto } from "@vocare/shared";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { localEstoque, movimentoEstoque, produto, saldoEstoque } from "../../../db/tabelas/estoque";
import { estornarMovimento, lancarMovimento, sairPorFefo, type Tx } from "./movimento";
import { conferirLocal, conferirProduto } from "./validar";

type Mexeu = { produtoId: string; localId: string };

const naoEstornado = sql`not exists (select 1 from "movimento_estoque" as e where e."estorna_id" = "movimento_estoque"."id")`;

const unicos = (itens: Mexeu[]) => [...new Map(itens.map((i) => [`${i.produtoId}|${i.localId}`, i])).values()];

/**
 * Acerta a ração que saiu pelo registro diário de um galpão: compara o que o
 * registro diz hoje (`racaoKg`) com o que já saiu por ele e, se mudou, estorna
 * e lança de novo. A ração sai do silo ativo ligado ao galpão, por FEFO entre
 * as rações com saldo ali; a sobra sai da última ração que entrou no silo
 * (o saldo fica negativo). `semSilo`: havia ração para baixar e não deu.
 */
export async function sincronizarRacao(
  tx: Tx,
  a: { orgId: string; userId: string | null; instalacaoId: string; apontamentoId: string; data: string; racaoKg: number | null },
): Promise<{ semSilo: boolean; mexeu: Mexeu[] }> {
  const desejado = arredondar(a.racaoKg ?? 0, 3);
  const atuais = await tx
    .select({ id: movimentoEstoque.id, produtoId: movimentoEstoque.produtoId, localId: movimentoEstoque.localId, quantidade: movimentoEstoque.quantidade })
    .from(movimentoEstoque)
    .where(
      and(
        eq(movimentoEstoque.organizationId, a.orgId),
        eq(movimentoEstoque.origemTipo, "apontamento_aviario"),
        eq(movimentoEstoque.origemId, a.apontamentoId),
        eq(movimentoEstoque.tipo, "saida"),
        naoEstornado,
      ),
    );
  const jaSaiu = arredondar(
    atuais.reduce((t, m) => t - Number(m.quantidade), 0),
    3,
  );
  if (desejado === jaSaiu) return { semSilo: false, mexeu: [] };

  const mexeu: Mexeu[] = [];
  for (const m of atuais) {
    await estornarMovimento(tx, a.orgId, a.userId, m.id, "Registro diário corrigido.");
    mexeu.push({ produtoId: m.produtoId, localId: m.localId });
  }
  if (desejado <= 0) return { semSilo: false, mexeu: unicos(mexeu) };

  const [silo] = await tx
    .select({ id: localEstoque.id })
    .from(localEstoque)
    .where(
      and(
        eq(localEstoque.organizationId, a.orgId),
        eq(localEstoque.instalacaoId, a.instalacaoId),
        eq(localEstoque.tipo, "silo"),
        eq(localEstoque.ativo, true),
      ),
    );
  if (!silo) {
    // Sem nenhum silo na organização, a ração ainda não é controlada pelo estoque: não há o que avisar.
    const [algum] = await tx
      .select({ id: localEstoque.id })
      .from(localEstoque)
      .where(and(eq(localEstoque.organizationId, a.orgId), eq(localEstoque.tipo, "silo"), eq(localEstoque.ativo, true)))
      .limit(1);
    return { semSilo: Boolean(algum), mexeu: unicos(mexeu) };
  }

  const saldos = await tx
    .select({ produtoId: saldoEstoque.produtoId, lote: saldoEstoque.loteFabricacao, quantidade: saldoEstoque.quantidade, validade: saldoEstoque.validade, desde: saldoEstoque.createdAt })
    .from(saldoEstoque)
    .innerJoin(produto, eq(produto.id, saldoEstoque.produtoId))
    .where(and(eq(saldoEstoque.localId, silo.id), eq(produto.categoria, "racao")));
  const chave = (produtoId: string, lote: string) => `${produtoId}|${lote}`;
  const validadeDe = new Map(saldos.map((s) => [chave(s.produtoId, s.lote), s.validade]));
  const r = repartirFefo(
    saldos.map((s) => ({ chave: chave(s.produtoId, s.lote), quantidade: Number(s.quantidade), validade: s.validade, desde: s.desde.toISOString() })),
    desejado,
  );
  const partes = r.partes;

  if (r.sobra > 0) {
    const [ultima] = await tx
      .select({ produtoId: movimentoEstoque.produtoId })
      .from(movimentoEstoque)
      .innerJoin(produto, eq(produto.id, movimentoEstoque.produtoId))
      .where(and(eq(movimentoEstoque.localId, silo.id), gt(movimentoEstoque.quantidade, "0"), eq(produto.categoria, "racao"), inArray(movimentoEstoque.tipo, ["entrada", "transferencia", "ajuste"])))
      .orderBy(desc(movimentoEstoque.createdAt))
      .limit(1);
    if (!ultima && partes.length === 0) return { semSilo: true, mexeu: unicos(mexeu) };
    const destino = chave(ultima?.produtoId ?? partes[partes.length - 1]!.chave.split("|")[0]!, "");
    const igual = partes.find((p) => p.chave === destino);
    if (igual) igual.quantidade = arredondar(igual.quantidade + r.sobra, 3);
    else partes.push({ chave: destino, quantidade: r.sobra });
  }

  for (const parte of partes) {
    const [produtoId, lote] = parte.chave.split("|") as [string, string];
    await lancarMovimento(tx, {
      orgId: a.orgId,
      userId: a.userId,
      produtoId,
      localId: silo.id,
      tipo: "saida",
      quantidade: -parte.quantidade,
      loteFabricacao: lote,
      validade: validadeDe.get(parte.chave) ?? null,
      data: a.data,
      origemTipo: "apontamento_aviario",
      origemId: a.apontamentoId,
    });
    mexeu.push({ produtoId, localId: silo.id });
  }
  return { semSilo: false, mexeu: unicos(mexeu) };
}

/**
 * Baixa de um insumo aplicado (vacina, remédio). Sem local informado, usa o
 * único local com saldo do produto; o lote sai por FEFO se não for informado.
 */
export async function baixarInsumo(
  tx: Tx,
  a: {
    orgId: string;
    userId: string | null;
    origemTipo: "vacinacao_lote" | "vacina" | "tratamento" | "ocorrencia";
    origemId: string;
    data: string;
    produtoId: string;
    localId?: string | null;
    quantidade: number;
    loteFabricacao?: string | null;
    categorias: CategoriaProduto[];
  },
): Promise<Resultado<Mexeu>> {
  const p = await conferirProduto(tx, a.orgId, a.produtoId);
  if (!p.ok) return p;
  if (!a.categorias.includes(p.valor.categoria as CategoriaProduto)) {
    const nomes = a.categorias.map((c) => ROTULO_CATEGORIA_PRODUTO[c].toLowerCase()).join(" ou ");
    return falha(400, `Este produto não é ${nomes}.`);
  }

  let localId = a.localId ?? null;
  if (localId) {
    const l = await conferirLocal(tx, a.orgId, localId);
    if (!l.ok) return l;
  } else {
    const comSaldo = await tx
      .selectDistinct({ localId: saldoEstoque.localId })
      .from(saldoEstoque)
      .innerJoin(localEstoque, eq(localEstoque.id, saldoEstoque.localId))
      .where(and(eq(saldoEstoque.produtoId, a.produtoId), gt(saldoEstoque.quantidade, "0"), eq(localEstoque.ativo, true)));
    if (comSaldo.length !== 1) return falha(422, "Escolha o local do estoque.");
    localId = comSaldo[0]!.localId;
  }

  await sairPorFefo(tx, {
    orgId: a.orgId,
    userId: a.userId,
    produtoId: a.produtoId,
    localId,
    quantidade: a.quantidade,
    data: a.data,
    origemTipo: a.origemTipo,
    origemId: a.origemId,
    loteFabricacao: a.loteFabricacao ?? undefined,
  });
  return ok({ produtoId: a.produtoId, localId });
}
