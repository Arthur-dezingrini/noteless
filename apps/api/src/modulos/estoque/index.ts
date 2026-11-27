/**
 * Módulo estoque: produtos, locais, fornecedores, entradas e o livro de
 * movimentos com saldo por produto × local × lote. Outros módulos usam só o
 * que está aqui; o estoque não importa de nenhum deles.
 */
export { estoqueRotas } from "./rotas";
export { baixarInsumo, sincronizarRacao } from "./regras/baixas";
export { avisarGalpaoSemSilo, avisarSaldoNegativo } from "./regras/negativo";
