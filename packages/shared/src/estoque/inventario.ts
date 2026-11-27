import { z } from "zod";

import { UNIDADES_ESTOQUE } from "./constantes";

/** Inventário: contagem de um local; ao fechar, a diferença vira ajuste no estoque. */

export const STATUS_INVENTARIO = ["aberto", "fechado", "cancelado"] as const;
export type StatusInventario = (typeof STATUS_INVENTARIO)[number];

export const abrirInventarioSchema = z.object({ localId: z.string().trim().min(1, "Escolha o local.") });

export const contagemSchema = z
  .array(
    z.object({
      produtoId: z.string().trim().min(1, "Campo obrigatório."),
      loteFabricacao: z.string().trim().max(40, "No máximo 40 caracteres.").default(""),
      quantidadeContada: z.number({ error: "Informe a quantidade contada." }).nonnegative("A quantidade contada não pode ser negativa."),
    }),
  )
  .max(500, "No máximo 500 itens.");
export type Contagem = z.infer<typeof contagemSchema>;

export const itemInventarioSchema = z.object({
  produtoId: z.string(),
  produtoNome: z.string(),
  unidade: z.enum(UNIDADES_ESTOQUE),
  loteFabricacao: z.string(),
  /** Saldo do sistema agora (só no inventário aberto). */
  saldoAtual: z.number().nullable(),
  quantidadeContada: z.number().nullable(),
  /** Saldo do sistema na hora de fechar. */
  quantidadeSistema: z.number().nullable(),
  /** Contado − sistema (prévia no aberto; o ajuste lançado no fechado). */
  diferenca: z.number().nullable(),
});

export const inventarioSchema = z.object({
  id: z.string(),
  localId: z.string(),
  localNome: z.string(),
  status: z.enum(STATUS_INVENTARIO),
  abertoEm: z.string(),
  fechadoEm: z.string().nullable(),
  itens: z.array(itemInventarioSchema),
});
export type Inventario = z.infer<typeof inventarioSchema>;

export const inventarioResumoSchema = inventarioSchema.omit({ itens: true }).extend({ contados: z.number() });
export type InventarioResumo = z.infer<typeof inventarioResumoSchema>;
