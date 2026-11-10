/**
 * Módulo aviário: galpões, lotes, alojamentos, apontamentos diários, pesagem
 * e vacinação de lote. Outros módulos usam só o que está aqui.
 */
export { aviarioRotas } from "./rotas";
export { aplicarAviario } from "./regras/aplicar";
export { galpoesDaOrg, type GalpaoParaIa } from "./consultas/galpoes-ia";
