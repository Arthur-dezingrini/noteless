import type { OrigemMovimento, TipoMovimento, UnidadeEstoque } from "@vocare/shared";

/** Textos e formatos das telas do estoque. */

export const ROTULO_ORIGEM: Record<OrigemMovimento, string> = {
  entrada: "Compra",
  manual: "Manual",
  transferencia: "Transferência",
  inventario: "Inventário",
  apontamento_aviario: "Registro diário",
  vacinacao_lote: "Vacinação de lote",
  vacina: "Vacina",
  tratamento: "Tratamento",
  ocorrencia: "Nota",
};

export const ROTULO_TIPO_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
  ajuste: "Ajuste",
  estorno: "Estorno",
};

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const qtd = (n: number, unidade?: UnidadeEstoque) => `${numero.format(n)}${unidade ? ` ${unidade}` : ""}`;
export const dinheiro = (n: number) => moeda.format(n);
export const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** "1.234,5" ou "1234.5" → 1234.5; vazio → null; inválido → NaN. */
export function lerNumero(valor: FormDataEntryValue | null | undefined): number | null {
  let t = String(valor ?? "").trim();
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isNaN(n) ? Number.NaN : n;
}

/** POST/PATCH à api pelo rewrite; devolve o corpo ou o erro com o status (o 409 de saldo traz `saldo`). */
export async function enviar<T>(
  caminho: string,
  corpo: unknown,
  metodo = "POST",
): Promise<{ ok: true; data: T } | { ok: false; status: number; erro: string; saldo?: number }> {
  const res = await fetch(caminho, { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const body = (await res.json().catch(() => null)) as (T & { error?: string; saldo?: number }) | null;
  if (res.ok) return { ok: true, data: body as T };
  return { ok: false, status: res.status, erro: body?.error ?? "Não foi possível concluir. Tente de novo.", saldo: body?.saldo };
}
