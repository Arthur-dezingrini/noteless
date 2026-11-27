import { converterUnidadeDita, operacaoSchema, type CategoriaProduto, type Operacao } from "@vocare/shared";

import type { EstoqueParaIa } from "../../estoque";

const nulo = (v: unknown) => (v === undefined || v === "" ? null : v);
const chave = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Item da lista pelo id que a IA mandou, ou pelo nome dito (igual, ou um único que contém o outro). */
function achar<T extends { id: string; nome: string }>(lista: T[], id: unknown, dito: unknown): T | null {
  const porId = typeof id === "string" ? lista.find((x) => x.id === id) : undefined;
  if (porId) return porId;
  const d = chave(dito);
  if (!d) return null;
  const igual = lista.filter((x) => chave(x.nome) === d);
  if (igual.length === 1) return igual[0]!;
  const parecidos = lista.filter((x) => chave(x.nome).includes(d) || d.includes(chave(x.nome)));
  return parecidos.length === 1 ? parecidos[0]! : null;
}

const quantidadeDita = (v: unknown) => {
  const n = v === null || v === undefined || v === "" ? null : Number(v);
  return n !== null && Number.isFinite(n) && n > 0 ? n : null;
};

const INSUMOS: CategoriaProduto[] = ["vacina", "medicamento"];

/**
 * Vacina ou remédio da nota que está no estoque: o produto (só vacina ou
 * medicamento), e local, quantidade e lote se ditos. Sem estoque, nada —
 * a operação fica como era antes do estoque.
 */
export function insumoDito(nome: unknown, bruta: Record<string, unknown>, estoque: EstoqueParaIa) {
  if (estoque.produtos.length === 0) return {};
  const p = achar(
    estoque.produtos.filter((x) => INSUMOS.includes(x.categoria)),
    bruta.produtoId,
    nome,
  );
  const local = achar(estoque.locais, bruta.localId, bruta.local);
  const qtd = quantidadeDita(bruta.quantidade);
  return {
    produtoId: p?.id ?? null,
    localId: local?.id ?? null,
    quantidade: p && qtd !== null ? converterUnidadeDita(qtd, typeof bruta.unidade === "string" ? bruta.unidade : null, p) : qtd,
    loteFabricacao: (nulo(bruta.loteFabricacao) as string | null) ?? null,
  };
}

/** entrada_estoque / saida_estoque: produto e local da lista (pelo id ou pelo nome dito), quantidade na unidade de estoque. */
export function normalizarEstoque(tipo: string, bruta: Record<string, unknown>, estoque: EstoqueParaIa): Operacao | null {
  if (estoque.produtos.length === 0) return null;
  const dito = bruta.produto ?? bruta.alvo;
  const p = achar(estoque.produtos, bruta.produtoId, dito);
  const local = achar(estoque.locais, bruta.localId, bruta.local);
  const qtd = quantidadeDita(bruta.quantidade);
  const quantidade = p && qtd !== null ? converterUnidadeDita(qtd, typeof bruta.unidade === "string" ? bruta.unidade : null, p) : qtd;
  const confianca = Math.max(0, Math.min(100, Math.round(Number(bruta.confianca) || 0)));
  const completa = p && local && quantidade !== null;

  const comum = {
    titulo: String(bruta.titulo ?? ""),
    alvo: String(bruta.alvo ?? ""),
    animalId: null,
    grupoId: null,
    detalhe: String(bruta.detalhe ?? ""),
    confianca: completa ? confianca : Math.min(confianca, 60),
    trecho: String(bruta.trecho ?? ""),
    tipo,
    produto: String(dito ?? ""),
    produtoId: p?.id ?? null,
    local: nulo(bruta.local),
    localId: local?.id ?? null,
    quantidade,
    unidade: p?.unidade ?? nulo(bruta.unidade),
    data: nulo(bruta.data),
  };
  const valor = quantidadeDita(bruta.valorTotal);
  const candidata =
    tipo === "entrada_estoque"
      ? {
          ...comum,
          fornecedor: nulo(bruta.fornecedor),
          numeroNota: bruta.numeroNota == null || bruta.numeroNota === "" ? null : String(bruta.numeroNota),
          valorTotal: valor,
          loteFabricacao: nulo(bruta.loteFabricacao),
          validade: nulo(bruta.validade),
        }
      : { ...comum, motivo: nulo(bruta.motivo) };
  const parsed = operacaoSchema.safeParse(candidata);
  return parsed.success ? parsed.data : null;
}
