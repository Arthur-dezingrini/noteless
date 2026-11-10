/**
 * Contrato entre apps/web e apps/api.
 *
 * Tudo que atravessa a fronteira HTTP entre os dois passa por aqui: o mesmo
 * schema Zod valida a entrada no front antes de enviar e a resposta do back
 * ao chegar. Se o contrato mudar, os dois lados quebram em tempo de compilação.
 */
export * from "./auth";
export * from "./usuarios";
export * from "./animais";
export * from "./consultas";
export * from "./ocorrencias";
export * from "./grupos";
export * from "./ficha";
export * from "./notificacoes";
export * from "./inicio";
export * from "./relatorios";
export * from "./prontuarios";
export * from "./lotes";
export * from "./indicadores-lote";
