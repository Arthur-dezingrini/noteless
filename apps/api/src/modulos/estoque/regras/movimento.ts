import { arredondar, novoCustoMedio, repartirFefo, type OrigemMovimento, type TipoMovimento } from "@vocare/shared";
import { and, eq, sql } from "drizzle-orm";

import { hojeISO } from "../../../base/datas";
import { falha, ok, type Resultado } from "../../../base/resultado";
import type { db } from "../../../db";
import { movimentoEstoque, produto, saldoEstoque } from "../../../db/tabelas/estoque";
import { recalcularCustoMedio } from "./custo";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NovoMovimento = {
  orgId: string;
  userId: string | null;
  produtoId: string;
  localId: string;
  tipo: TipoMovimento;
  /** Com sinal: + entra, − sai. */
  quantidade: number;
  /** Entrada: o custo da compra por unidade de estoque (sem ele, o custo médio não muda). Saída: o custo médio atual. */
  custoUnitario?: number;
  loteFabricacao?: string;
  validade?: string | null;
  data: string;
  origemTipo: OrigemMovimento;
  origemId?: string | null;
  grupoId?: string | null;
  estornaId?: string | null;
  motivo?: string | null;
  ocorrenciaId?: string | null;
};

/**
 * A única porta de escrita do livro: grava o movimento, soma no saldo e, na
 * entrada com custo, atualiza o custo médio — tudo na transação de quem chamou.
 * A linha do produto é travada (`for update`) para o custo médio não se perder
 * quando duas entradas chegam juntas.
 */
export async function lancarMovimento(tx: Tx, m: NovoMovimento): Promise<{ id: string; saldoLocal: number }> {
  const [p] = await tx
    .select({ custoMedio: produto.custoMedio })
    .from(produto)
    .where(and(eq(produto.id, m.produtoId), eq(produto.organizationId, m.orgId)))
    .for("update");
  if (!p) throw new Error("Produto de outra organização no livro do estoque.");

  const quantidade = arredondar(m.quantidade, 3);
  const loteFabricacao = m.loteFabricacao ?? "";
  const entraComCusto = m.tipo === "entrada" && quantidade > 0 && (m.custoUnitario ?? 0) > 0;
  const custoUnitario = m.custoUnitario ?? (m.tipo === "entrada" ? 0 : Number(p.custoMedio));

  if (entraComCusto) {
    const [total] = await tx
      .select({ q: sql<string>`coalesce(sum(${saldoEstoque.quantidade}), 0)` })
      .from(saldoEstoque)
      .where(eq(saldoEstoque.produtoId, m.produtoId));
    const custo = novoCustoMedio(Number(total?.q ?? 0), Number(p.custoMedio), quantidade, custoUnitario);
    await tx.update(produto).set({ custoMedio: String(custo) }).where(eq(produto.id, m.produtoId));
  }

  const [mov] = await tx
    .insert(movimentoEstoque)
    .values({
      organizationId: m.orgId,
      criadoPorId: m.userId,
      produtoId: m.produtoId,
      localId: m.localId,
      loteFabricacao,
      validade: m.validade ?? null,
      tipo: m.tipo,
      quantidade: String(quantidade),
      custoUnitario: String(arredondar(custoUnitario, 4)),
      data: m.data,
      origemTipo: m.origemTipo,
      origemId: m.origemId ?? null,
      grupoId: m.grupoId ?? null,
      estornaId: m.estornaId ?? null,
      motivo: m.motivo ?? null,
      ocorrenciaId: m.ocorrenciaId ?? null,
    })
    .returning({ id: movimentoEstoque.id });

  const [saldo] = await tx
    .insert(saldoEstoque)
    .values({
      organizationId: m.orgId,
      produtoId: m.produtoId,
      localId: m.localId,
      loteFabricacao,
      validade: m.validade ?? null,
      quantidade: String(quantidade),
    })
    .onConflictDoUpdate({
      target: [saldoEstoque.produtoId, saldoEstoque.localId, saldoEstoque.loteFabricacao],
      set: {
        quantidade: sql`${saldoEstoque.quantidade} + excluded."quantidade"`,
        validade: sql`coalesce(${saldoEstoque.validade}, excluded."validade")`,
        updatedAt: new Date(),
      },
    })
    .returning({ quantidade: saldoEstoque.quantidade });

  return { id: mov!.id, saldoLocal: Number(saldo!.quantidade) };
}

export type Saida = Omit<NovoMovimento, "quantidade" | "loteFabricacao" | "validade" | "tipo"> & {
  /** Positiva: quanto sai. */
  quantidade: number;
  tipo?: "saida" | "ajuste" | "transferencia";
  /** Informado, sai só desse lote; sem ele, FEFO. */
  loteFabricacao?: string;
};

/**
 * Saída que escolhe os lotes por FEFO. O que nenhum lote cobre sai do lote
 * vazio e deixa o saldo negativo — nada bloqueia por falta de saldo.
 */
export async function sairPorFefo(tx: Tx, a: Saida): Promise<string[]> {
  const { quantidade, tipo = "saida", loteFabricacao, ...resto } = a;
  const saldos = await tx
    .select({ lote: saldoEstoque.loteFabricacao, quantidade: saldoEstoque.quantidade, validade: saldoEstoque.validade, desde: saldoEstoque.createdAt })
    .from(saldoEstoque)
    .where(and(eq(saldoEstoque.produtoId, a.produtoId), eq(saldoEstoque.localId, a.localId)));
  const validadeDe = new Map(saldos.map((s) => [s.lote, s.validade]));

  let partes: { chave: string; quantidade: number }[];
  if (loteFabricacao !== undefined) {
    partes = [{ chave: loteFabricacao, quantidade }];
  } else {
    const r = repartirFefo(
      saldos.map((s) => ({ chave: s.lote, quantidade: Number(s.quantidade), validade: s.validade, desde: s.desde.toISOString() })),
      quantidade,
    );
    partes = r.partes;
    if (r.sobra > 0) {
      const vazio = partes.find((p) => p.chave === "");
      if (vazio) vazio.quantidade = arredondar(vazio.quantidade + r.sobra, 3);
      else partes.push({ chave: "", quantidade: r.sobra });
    }
  }

  const ids: string[] = [];
  for (const parte of partes) {
    const { id } = await lancarMovimento(tx, {
      ...resto,
      tipo,
      quantidade: -parte.quantidade,
      loteFabricacao: parte.chave,
      validade: validadeDe.get(parte.chave) ?? null,
    });
    ids.push(id);
  }
  return ids;
}

/**
 * Estorna um movimento (e o outro lado, se for transferência) com uma linha
 * oposta que aponta para o original. Movimento não se edita nem se apaga.
 */
export async function estornarMovimento(
  tx: Tx,
  orgId: string,
  userId: string | null,
  movimentoId: string,
  motivo: string,
): Promise<Resultado<string[]>> {
  const [alvo] = await tx
    .select()
    .from(movimentoEstoque)
    .where(and(eq(movimentoEstoque.id, movimentoId), eq(movimentoEstoque.organizationId, orgId)));
  if (!alvo) return falha(404, "Movimento não encontrado.");
  if (alvo.tipo === "estorno") return falha(409, "Estorno não se estorna.");

  const grupo = alvo.grupoId
    ? await tx
        .select()
        .from(movimentoEstoque)
        .where(and(eq(movimentoEstoque.grupoId, alvo.grupoId), eq(movimentoEstoque.organizationId, orgId), sql`${movimentoEstoque.tipo} <> 'estorno'`))
    : [alvo];

  const [jaFeito] = await tx
    .select({ id: movimentoEstoque.id })
    .from(movimentoEstoque)
    .where(sql`${movimentoEstoque.estornaId} in (${sql.join(
      grupo.map((g) => sql`${g.id}`),
      sql`, `,
    )})`)
    .limit(1);
  if (jaFeito) return falha(409, "Este movimento já foi estornado.");

  const ids: string[] = [];
  for (const m of grupo) {
    const { id } = await lancarMovimento(tx, {
      orgId,
      userId,
      produtoId: m.produtoId,
      localId: m.localId,
      tipo: "estorno",
      quantidade: -Number(m.quantidade),
      custoUnitario: Number(m.custoUnitario),
      loteFabricacao: m.loteFabricacao,
      validade: m.validade,
      data: hojeISO(),
      origemTipo: m.origemTipo as OrigemMovimento,
      origemId: m.origemId,
      grupoId: m.grupoId,
      estornaId: m.id,
      motivo,
    });
    ids.push(id);
  }
  for (const produtoId of new Set(grupo.filter((m) => m.tipo === "entrada").map((m) => m.produtoId))) {
    await recalcularCustoMedio(tx, produtoId);
  }
  return ok(ids);
}
