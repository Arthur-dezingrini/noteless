import { arredondar, converterParaUnidade, type ConfirmarNfe, type NfeLida, type PreEntradaNfe } from "@vocare/shared";
import { and, eq, isNull } from "drizzle-orm";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { entrada, fornecedor, produtoFornecedor } from "../../../db/tabelas/estoque";
import { unicoViolado } from "./falha";
import { lancarMovimento } from "./movimento";
import { lerNfe } from "./nfe-leitura";
import { conferirData, conferirLocal, conferirProduto } from "./validar";

export const LIMITE_XML = 1_000_000;
const JA_IMPORTADA = "Esta NF-e já foi importada.";

function lerDentroDoLimite(xml: string): Resultado<NfeLida> {
  if (xml.length > LIMITE_XML) return falha(413, "O XML passa de 1 MB.");
  return lerNfe(xml);
}

async function jaImportada(orgId: string, chave: string) {
  const [e] = await db
    .select({ id: entrada.id })
    .from(entrada)
    .where(and(eq(entrada.organizationId, orgId), eq(entrada.chaveNfe, chave), isNull(entrada.estornadaEm)));
  return Boolean(e);
}

async function fornecedorPeloDocumento(orgId: string, documento: string) {
  if (!documento) return null;
  const [f] = await db
    .select({ id: fornecedor.id, nome: fornecedor.nome })
    .from(fornecedor)
    .where(and(eq(fornecedor.organizationId, orgId), eq(fornecedor.documento, documento)));
  return f ?? null;
}

/** Lê a nota para a tela de conferência, sem gravar: cada item vem com o vínculo já aprendido, se houver. */
export async function lerParaConferir(orgId: string, xml: string): Promise<Resultado<PreEntradaNfe>> {
  const lida = lerDentroDoLimite(xml);
  if (!lida.ok) return lida;
  const nota = lida.valor;
  if (await jaImportada(orgId, nota.chave)) return falha(409, JA_IMPORTADA);

  const forn = await fornecedorPeloDocumento(orgId, nota.emitente.documento);
  const vinculos = forn ? await db.select().from(produtoFornecedor).where(eq(produtoFornecedor.fornecedorId, forn.id)) : [];
  const porCodigo = new Map(vinculos.map((v) => [v.codigo, v]));
  return ok({
    ...nota,
    fornecedor: forn,
    sugestoes: nota.itens.map((i) => {
      const v = porCodigo.get(i.codigo);
      return v ? { produtoId: v.produtoId, fator: Number(v.fator), localId: v.localId } : null;
    }),
  });
}

/**
 * Grava a nota conferida: fornecedor (se novo), a entrada com o XML, um
 * movimento por lote (ou um só, sem lote) e o vínculo código do fornecedor →
 * produto. O XML é relido aqui: valores e lotes vêm da nota, não da tela.
 */
export async function confirmarNfe(orgId: string, userId: string, dados: ConfirmarNfe): Promise<Resultado<string>> {
  const lida = lerDentroDoLimite(dados.xml);
  if (!lida.ok) return lida;
  const nota = lida.valor;
  if (await jaImportada(orgId, nota.chave)) return falha(409, JA_IMPORTADA);

  const data = dados.data ?? nota.emissao;
  const d = conferirData(data);
  if (!d.ok) return d;

  const indices = new Set(dados.itens.map((i) => i.indice));
  if (indices.size !== dados.itens.length || dados.itens.some((i) => i.indice >= nota.itens.length)) return falha(400, "Item da nota inválido.");

  type Lote = { lote: string; quantidade: number; validade?: string | null };
  const planos: { item: NfeLida["itens"][number]; escolha: ConfirmarNfe["itens"][number]; lotes: Lote[]; custoUnitario: number }[] = [];
  for (const escolha of dados.itens) {
    const item = nota.itens[escolha.indice]!;
    const p = await conferirProduto(db, orgId, escolha.produtoId);
    if (!p.ok) return p;
    const l = await conferirLocal(db, orgId, escolha.localId);
    if (!l.ok) return l;

    const lotes: Lote[] = escolha.lotes ?? item.lotes;
    if (p.valor.controlaLote && (lotes.length === 0 || lotes.some((x) => !x.lote || !x.validade))) {
      return falha(400, `Informe o lote e a validade de ${item.descricao}.`);
    }
    if (lotes.length > 0) {
      const soma = arredondar(
        lotes.reduce((t, x) => t + x.quantidade, 0),
        3,
      );
      if (soma !== arredondar(item.quantidade, 3)) return falha(400, `Os lotes de ${item.descricao} não somam a quantidade da nota.`);
    }
    const quantidade = converterParaUnidade(item.quantidade, escolha.fator);
    planos.push({ item, escolha, lotes, custoUnitario: quantidade > 0 ? item.custoTotal / quantidade : 0 });
  }

  try {
    const id = await db.transaction(async (tx) => {
      const documento = nota.emitente.documento || null;
      let [forn] = documento
        ? await tx
            .select({ id: fornecedor.id })
            .from(fornecedor)
            .where(and(eq(fornecedor.organizationId, orgId), eq(fornecedor.documento, documento)))
        : [];
      if (!forn) {
        [forn] = await tx
          .insert(fornecedor)
          .values({ organizationId: orgId, criadoPorId: userId, nome: nota.emitente.nome || "Fornecedor da NF-e", documento, telefone: nota.emitente.telefone })
          .returning({ id: fornecedor.id });
      }

      const [doc] = await tx
        .insert(entrada)
        .values({
          organizationId: orgId,
          criadoPorId: userId,
          fornecedorId: forn!.id,
          numeroNota: nota.numero,
          serie: nota.serie,
          chaveNfe: nota.chave,
          dataEmissao: nota.emissao || null,
          data,
          valorTotal: String(arredondar(nota.valorTotal, 2)),
          origem: "nfe",
          xml: dados.xml,
        })
        .returning({ id: entrada.id });

      for (const { item, escolha, lotes, custoUnitario } of planos) {
        const partes = lotes.length > 0 ? lotes.map((x) => ({ lote: x.lote, quantidade: x.quantidade, validade: x.validade ?? null })) : [{ lote: "", quantidade: item.quantidade, validade: null }];
        for (const parte of partes) {
          await lancarMovimento(tx, {
            orgId,
            userId,
            produtoId: escolha.produtoId,
            localId: escolha.localId,
            tipo: "entrada",
            quantidade: converterParaUnidade(parte.quantidade, escolha.fator),
            custoUnitario: custoUnitario > 0 ? custoUnitario : undefined,
            loteFabricacao: parte.lote,
            validade: parte.validade,
            data,
            origemTipo: "entrada",
            origemId: doc!.id,
          });
        }
        await tx
          .insert(produtoFornecedor)
          .values({
            organizationId: orgId,
            criadoPorId: userId,
            fornecedorId: forn!.id,
            codigo: item.codigo,
            unidadeCompra: item.unidade,
            fator: String(escolha.fator),
            produtoId: escolha.produtoId,
            localId: escolha.localId,
          })
          .onConflictDoUpdate({
            target: [produtoFornecedor.fornecedorId, produtoFornecedor.codigo],
            set: { unidadeCompra: item.unidade, fator: String(escolha.fator), produtoId: escolha.produtoId, localId: escolha.localId },
          });
      }
      return doc!.id;
    });
    return ok(id);
  } catch (e) {
    const indice = unicoViolado(e);
    if (indice !== null && (indice === "" || indice.includes("chave_nfe"))) return falha(409, JA_IMPORTADA);
    throw e;
  }
}
