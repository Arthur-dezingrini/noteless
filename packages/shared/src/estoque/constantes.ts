/** Valores fixos do estoque de insumos: categorias, unidades, locais e movimentos. */

export const CATEGORIAS_PRODUTO = ["racao", "vacina", "medicamento", "material", "outro"] as const;
export type CategoriaProduto = (typeof CATEGORIAS_PRODUTO)[number];
export const ROTULO_CATEGORIA_PRODUTO: Record<CategoriaProduto, string> = {
  racao: "Ração",
  vacina: "Vacina",
  medicamento: "Medicamento",
  material: "Material",
  outro: "Outro",
};
/** Categorias que exigem lote de fabricação e validade por padrão. */
export const CATEGORIAS_COM_LOTE: readonly CategoriaProduto[] = ["vacina", "medicamento"];

export const UNIDADES_ESTOQUE = ["kg", "l", "ml", "dose", "un"] as const;
export type UnidadeEstoque = (typeof UNIDADES_ESTOQUE)[number];

export const TIPOS_LOCAL = ["silo", "deposito", "geladeira", "farmacia", "outro"] as const;
export type TipoLocal = (typeof TIPOS_LOCAL)[number];
export const ROTULO_TIPO_LOCAL: Record<TipoLocal, string> = {
  silo: "Silo",
  deposito: "Depósito",
  geladeira: "Geladeira",
  farmacia: "Farmácia",
  outro: "Outro",
};

export const TIPOS_MOVIMENTO = ["entrada", "saida", "transferencia", "ajuste", "estorno"] as const;
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number];

/** De onde veio o movimento; com o `origemId`, aponta o registro que o causou. */
export const ORIGENS_MOVIMENTO = [
  "entrada",
  "manual",
  "transferencia",
  "inventario",
  "apontamento_aviario",
  "vacinacao_lote",
  "vacina",
  "tratamento",
  "ocorrencia",
] as const;
export type OrigemMovimento = (typeof ORIGENS_MOVIMENTO)[number];

export const ORIGENS_ENTRADA = ["tela", "voz", "nfe"] as const;
export type OrigemEntrada = (typeof ORIGENS_ENTRADA)[number];

/** O que se decide por papel (hoje todos podem; perfis de acesso entram depois). */
export const ACOES_ESTOQUE = ["lancar", "verCusto", "acertarInventario", "cadastrar"] as const;
export type AcaoEstoque = (typeof ACOES_ESTOQUE)[number];
