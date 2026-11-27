import { and, eq, gte, lte, sql } from "drizzle-orm";

import { hojeISO, noDia } from "../../../base/datas";
import { db } from "../../../db";
import { apontamentoAviario, instalacao } from "../../../db/tabelas/aviario";
import { notificacao } from "../../../db/tabelas/avisos";
import { produto } from "../../../db/tabelas/estoque";
import { administradores, notificar } from "../../avisos";
import { saldoDaOrg } from "../consultas/saldo";

export const DIAS_RACAO_ACABANDO = 5;
export const DIAS_VALIDADE = 30;

type TipoAlerta = "abaixoMinimo" | "acabando" | "vencendo" | "negativos" | "semBaixa";
type Alerta = { tipo: TipoAlerta; texto: string; detalhe: string; link: string };

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
const entre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/** O que precisa de atenção no estoque da organização hoje. O texto é a chave: o mesmo aviso não sai duas vezes no dia. */
export async function alertasDaOrg(orgId: string, hoje = hojeISO()): Promise<Alerta[]> {
  const alertas = new Map<string, Alerta>();
  const add = (a: Alerta) => alertas.set(a.texto, a);

  for (const s of await saldoDaOrg(orgId, false, {}, hoje)) {
    const p = s.produto;
    if (p.estoqueMinimo != null && s.total < p.estoqueMinimo) {
      add({ tipo: "abaixoMinimo", texto: `${p.nome} abaixo do mínimo`, detalhe: `Saldo ${s.total} ${p.unidade}; mínimo ${p.estoqueMinimo} ${p.unidade}.`, link: "/estoque" });
    }
    for (const l of s.porLocal) {
      if (l.quantidade < 0) {
        add({ tipo: "negativos", texto: `Saldo negativo: ${p.nome} em ${l.localNome}`, detalhe: "Falta lançar uma entrada?", link: "/estoque" });
      }
      if (l.diasRestantes != null && l.diasRestantes <= DIAS_RACAO_ACABANDO) {
        const texto = l.diasRestantes <= 0 ? `Ração do ${l.localNome} acabou` : `Ração do ${l.localNome} acaba em ${dias(l.diasRestantes)}`;
        add({ tipo: "acabando", texto, detalhe: `Pelo consumo dos últimos 7 dias. Saldo: ${l.quantidade} ${p.unidade}.`, link: "/estoque" });
      }
      for (const lote of l.lotes) {
        if (lote.quantidade <= 0 || !lote.validade) continue;
        const faltam = entre(hoje, lote.validade);
        if (faltam > DIAS_VALIDADE) continue;
        const nome = `${p.nome}${lote.loteFabricacao ? ` lote ${lote.loteFabricacao}` : ""}`;
        const texto = faltam < 0 ? `${nome} venceu` : faltam === 0 ? `${nome} vence hoje` : `${nome} vence em ${dias(faltam)}`;
        add({ tipo: "vencendo", texto, detalhe: `${lote.quantidade} ${p.unidade} no ${l.localNome}.`, link: "/estoque" });
      }
    }
  }

  // Ração lançada no registro diário (hoje ou ontem) que não saiu do estoque: galpão sem silo, ou veio pela nota.
  const semBaixa = await db
    .selectDistinct({ nome: instalacao.nome })
    .from(apontamentoAviario)
    .innerJoin(instalacao, eq(instalacao.id, apontamentoAviario.instalacaoId))
    .where(
      and(
        eq(apontamentoAviario.organizationId, orgId),
        gte(apontamentoAviario.data, noDia(hoje, -1)),
        lte(apontamentoAviario.data, hoje),
        sql`${apontamentoAviario.racaoKg} > 0`,
        sql`not exists (select 1 from "movimento_estoque" as m where m."origem_tipo" = 'apontamento_aviario' and m."origem_id" = ${apontamentoAviario.id} and m."tipo" = 'saida' and not exists (select 1 from "movimento_estoque" as e where e."estorna_id" = m."id"))`,
      ),
    );
  for (const g of semBaixa) {
    add({ tipo: "semBaixa", texto: `Ração do ${g.nome} não saiu do estoque`, detalhe: "Ligue um silo ao galpão e lance a entrada da ração.", link: "/estoque/locais" });
  }
  return [...alertas.values()];
}

/**
 * Rotina diária: para cada organização que usa o estoque, avisa os
 * administradores do que precisa de atenção, sem repetir aviso já dado hoje.
 */
export async function conferirAvisosEstoque(agora: Date): Promise<{ avisos: number }> {
  const hoje = hojeISO(agora);
  const inicioDoDia = new Date(`${hoje}T00:00:00-03:00`);
  const orgs = await db.selectDistinct({ id: produto.organizationId }).from(produto).where(eq(produto.ativo, true));

  let avisos = 0;
  for (const { id: orgId } of orgs) {
    const alertas = await alertasDaOrg(orgId, hoje);
    if (alertas.length === 0) continue;
    const jaDados = await db
      .select({ texto: notificacao.texto })
      .from(notificacao)
      .where(and(eq(notificacao.organizationId, orgId), gte(notificacao.createdAt, inicioDoDia)));
    const dados = new Set(jaDados.map((d) => d.texto));
    const novos = alertas.filter((a) => !dados.has(a.texto));
    if (novos.length === 0) continue;
    const admins = await administradores(orgId);
    for (const a of novos) await notificar(orgId, admins, { texto: a.texto, detalhe: a.detalhe, link: a.link });
    avisos += novos.length;
  }
  return { avisos };
}

/** Quantos alertas de cada tipo a organização tem agora (cartão do painel). */
export async function resumoAvisosEstoque(orgId: string): Promise<Record<TipoAlerta, number>> {
  const resumo: Record<TipoAlerta, number> = { abaixoMinimo: 0, acabando: 0, vencendo: 0, negativos: 0, semBaixa: 0 };
  for (const a of await alertasDaOrg(orgId)) resumo[a.tipo] += 1;
  return resumo;
}
