import type { AceiteTermos } from "@vocare/shared";

/**
 * Se a pessoa precisa passar pela tela de aceite antes de entrar. Sem resposta
 * da api (`null`) ninguém fica trancado do lado de fora: o aceite é registro e
 * não pode derrubar o sistema.
 */
export function precisaAceitar(aceite: AceiteTermos | null, emVigor: boolean): boolean {
  return emVigor && aceite !== null && aceite.aceitoEm === null;
}
