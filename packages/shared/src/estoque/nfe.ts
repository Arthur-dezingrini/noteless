import { z } from "zod";

/** NF-e importada pelo XML: o que a nota traz e como cada item entra no estoque. */

export const nfeLidaSchema = z.object({
  chave: z.string(),
  numero: z.string(),
  serie: z.string(),
  /** AAAA-MM-DD */
  emissao: z.string(),
  modelo: z.enum(["55", "65"]),
  emitente: z.object({ documento: z.string(), nome: z.string(), telefone: z.string().nullable() }),
  destinatario: z.object({ documento: z.string().nullable(), nome: z.string().nullable() }),
  valorTotal: z.number(),
  itens: z.array(
    z.object({
      codigo: z.string(),
      descricao: z.string(),
      unidade: z.string(),
      quantidade: z.number(),
      /** vProd + vFrete + vSeg + vOutro − vDesc + vIPI + vICMSST */
      custoTotal: z.number(),
      lotes: z.array(z.object({ lote: z.string(), quantidade: z.number(), validade: z.string().nullable() })),
    }),
  ),
});
export type NfeLida = z.infer<typeof nfeLidaSchema>;

/** O que `nfe/ler` devolve: a nota e, por item, o vínculo já aprendido com o fornecedor. */
export const preEntradaNfeSchema = nfeLidaSchema.extend({
  fornecedor: z.object({ id: z.string(), nome: z.string() }).nullable(),
  sugestoes: z.array(z.object({ produtoId: z.string(), fator: z.number(), localId: z.string().nullable() }).nullable()),
});
export type PreEntradaNfe = z.infer<typeof preEntradaNfeSchema>;

export const lerNfeSchema = z.object({ xml: z.string().min(1, "Envie o XML da nota.") });

export const confirmarNfeSchema = z.object({
  xml: z.string().min(1, "Envie o XML da nota."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullish(),
  itens: z
    .array(
      z.object({
        indice: z.number().int().nonnegative(),
        produtoId: z.string().trim().min(1, "Escolha o produto de cada item."),
        fator: z.number().positive("O fator deve ser maior que zero."),
        localId: z.string().trim().min(1, "Escolha o local de cada item."),
        lotes: z
          .array(
            z.object({
              lote: z.string().trim().min(1).max(40),
              quantidade: z.number().positive(),
              validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullish(),
            }),
          )
          .optional(),
      }),
    )
    .min(1, "Inclua pelo menos um item."),
});
export type ConfirmarNfe = z.infer<typeof confirmarNfeSchema>;
