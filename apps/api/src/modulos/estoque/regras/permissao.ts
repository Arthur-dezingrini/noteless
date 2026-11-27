import type { AcaoEstoque, Papel } from "@vocare/shared";

/**
 * O único lugar que decide quem pode o quê no estoque. Por enquanto todos os
 * papéis podem tudo (decisão do Arthur, 26/11/2026); os perfis de acesso
 * entram aqui depois, sem mexer nas rotas.
 */
export function podeNoEstoque(papel: Papel, _acao: AcaoEstoque): boolean {
  return papel === "owner" || papel === "admin" || papel === "member";
}
