/** Contas do estoque, sem banco: custo médio, FEFO, conversão e dias restantes. */

/** Arredonda em `casas` decimais, sem o resíduo de ponto flutuante (0,1 + 0,2). */
export function arredondar(x: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round((x + Math.sign(x) * Number.EPSILON) * f) / f;
}

/**
 * Custo médio ponderado depois de uma compra. Saldo negativo conta como zero:
 * a compra que cobre um buraco não herda o custo de quem faltou lançar.
 */
export function novoCustoMedio(saldoTotal: number, custoAtual: number, qtd: number, custoCompra: number): number {
  const base = Math.max(saldoTotal, 0);
  const total = base + qtd;
  if (total <= 0) return arredondar(custoCompra, 4);
  return arredondar((base * custoAtual + qtd * custoCompra) / total, 4);
}

export type SaldoFefo = { chave: string; quantidade: number; validade: string | null; desde: string };

/**
 * De quais saldos sai `qtd`: primeiro o que vence antes (sem validade por
 * último) e, no empate, o que entrou primeiro. O que nenhum saldo cobre volta
 * em `sobra` — quem chama decide onde ele fica negativo.
 */
export function repartirFefo(saldos: SaldoFefo[], qtd: number): { partes: { chave: string; quantidade: number }[]; sobra: number } {
  const ordem = saldos
    .filter((s) => s.quantidade > 0)
    .sort((a, b) => {
      if (a.validade !== b.validade) {
        if (a.validade === null) return 1;
        if (b.validade === null) return -1;
        return a.validade < b.validade ? -1 : 1;
      }
      return a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0;
    });

  const partes: { chave: string; quantidade: number }[] = [];
  let falta = arredondar(qtd, 3);
  for (const s of ordem) {
    if (falta <= 0) break;
    const tira = arredondar(Math.min(s.quantidade, falta), 3);
    partes.push({ chave: s.chave, quantidade: tira });
    falta = arredondar(falta - tira, 3);
  }
  return { partes, sobra: Math.max(falta, 0) };
}

/** Quantidade da compra (saco, frasco) em unidade de estoque (kg, dose). */
export function converterParaUnidade(qtd: number, fator: number): number {
  return arredondar(qtd * fator, 3);
}

/** Quantos dias o saldo aguenta pela média dos últimos 7 dias; sem consumo, `null`. */
export function diasRestantes(saldo: number, consumo7Dias: number): number | null {
  if (consumo7Dias <= 0) return null;
  if (saldo <= 0) return 0;
  return Math.floor(saldo / (consumo7Dias / 7));
}

const chaveUnidade = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/s$/, "");

const SINONIMOS: Record<string, string[]> = {
  kg: ["kg", "quilo", "kilo", "quilograma"],
  l: ["l", "litro"],
  ml: ["ml", "mililitro"],
  dose: ["dose"],
  un: ["un", "unidade"],
};

/**
 * Quantidade dita ("300 sacos", "2 toneladas", "1 frasco") na unidade de
 * estoque do produto. Unidade vazia, igual à do produto ou desconhecida: fica
 * como foi dita.
 */
export function converterUnidadeDita(
  qtd: number,
  unidade: string | null | undefined,
  p: { unidade: string; embalagemNome: string | null; embalagemFator: number | null },
): number {
  const u = chaveUnidade(unidade);
  if (!u || SINONIMOS[p.unidade]?.includes(u)) return qtd;
  if (p.embalagemNome && p.embalagemFator && u === chaveUnidade(p.embalagemNome)) return arredondar(qtd * p.embalagemFator, 3);
  if (p.unidade === "kg" && ["tonelada", "t", "ton"].includes(u)) return arredondar(qtd * 1000, 3);
  return qtd;
}
