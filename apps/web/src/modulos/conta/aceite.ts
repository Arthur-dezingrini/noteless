import { VERSAO_TERMOS, type AceiteTermos } from "@vocare/shared";

/**
 * Se a pessoa precisa passar pela tela de aceite antes de entrar. Sem resposta
 * da api (`null`) ninguém fica trancado do lado de fora: o aceite é registro e
 * não pode derrubar o sistema.
 */
export function precisaAceitar(aceite: AceiteTermos | null, emVigor: boolean): boolean {
  return emVigor && aceite !== null && aceite.aceitoEm === null;
}

/**
 * A versão que vai no aceite: a que a api pediu. Web e api têm deploy
 * separado; mandar a do web quando as duas divergem dava 400 e trancava a
 * pessoa na tela de aceite.
 */
export function versaoParaAceitar(aceite: AceiteTermos | null): string {
  return aceite?.versao ?? VERSAO_TERMOS;
}
