# Super usuário e vínculo usuário–empresa — design

**Data:** 2026-11-11

**Pedido:**
- "o usuário só pode selecionar empresas que ele está vinculado";
- "a vinculação de usuário com a empresa não está legal, tem que fazer diferente, aonde eu que sou um super usuário consigo vincular qualquer usuário a qualquer empresa, na aba de configurações deve se fazer isso".

**Decisões do Arthur:**
- O super usuário é um **tipo de usuário**, configurável pela tela.
- O administrador da empresa gerencia **só a própria empresa**. Vincular conta existente passa a ser só do super usuário.

## Objetivo

O Arthur (e quem ele marcar) monta os acessos de toda a plataforma num lugar só: qualquer usuário em qualquer empresa, com o papel certo. Cada pessoa continua vendo e escolhendo só as empresas às quais está vinculada.

## Fora do escopo

- Criar ou editar empresa pela tela (continua pelo seed).
- Criar usuário novo pela aba Vínculos. Usuário novo continua sendo criado pelo administrador da empresa, em Configurações › Usuários.
- Entrar numa empresa sem vínculo, mesmo sendo super usuário.

## Tipo de usuário

- Campo novo `tipo` no usuário: `"comum"` (padrão) ou `"super"`.
  - Entra no Better Auth como `additionalFields.tipo` (`type: "string"`, `defaultValue: "comum"`, `input: false`). Assim ninguém consegue preencher pelo login nem pelo update do próprio perfil.
  - `schema.ts` é regenerado com `npm run auth:generate`, e a migration é gerada pelo drizzle-kit.
- **Rodar a migration** e **marcar o primeiro super usuário** gravam no banco compartilhado. As duas coisas rodam só com autorização do Arthur, no chat, na hora.
  - O primeiro super usuário é marcado por um comando novo, `npm run super -w @vocare/api -- <email>`, no padrão do `seed`.
- A sessão já devolve os campos extras do usuário. O shared ganha `tipoUsuarioSchema = z.enum(["comum", "super"])` no `sessionSchema`. O web lê o tipo pelo `getSession` do `dal.ts`.
- `src/base/super-usuario.ts` (api) exporta `superUsuario(headers): Promise<{ userId: string } | null>`. Ele lê a sessão e devolve `null` se não for super. É usado por todas as rotas `/api/admin`.

## API — `/api/admin` (módulo `conta`)

Todas as rotas:
- respondem 401 sem sessão;
- respondem 403 com `"Só o super usuário mexe nos vínculos."` quando a pessoa não é super, inclusive para dono de empresa.

| Rota | O que faz | Erros |
|---|---|---|
| `GET /api/admin/usuarios?busca=` | Todos os usuários (nome, e-mail, cargo, tipo), cada um com `vinculos: { memberId, organizationId, empresa, papel }[]`. Busca por nome ou e-mail, sem diferença de maiúscula. | — |
| `GET /api/admin/empresas` | Todas as empresas (`id`, `nome`). | — |
| `POST /api/admin/vinculos` `{ userId, organizationId, papel }` | Vincula. | 404 usuário ou empresa inexistente; 409 `"Essa pessoa já está nessa empresa."` |
| `PATCH /api/admin/vinculos/:memberId` `{ papel }` | Muda o papel. | 404; 422 se tira o último dono da empresa |
| `DELETE /api/admin/vinculos/:memberId` | Desvincula. | 404; 422 `"A empresa ficaria sem dono."` se for o último dono |
| `PATCH /api/admin/usuarios/:userId` `{ tipo }` | Marca ou desmarca super usuário. | 404; 422 `"Precisa sobrar pelo menos um super usuário."` |

- **Onde mora:**
  - `modulos/conta/rotas/admin.ts`;
  - `modulos/conta/regras/vinculos.ts` (devolve `Resultado`);
  - `modulos/conta/consultas/admin.ts`.
- **Montagem:** as rotas entram em `app.ts` em `/api/admin`.
- **Escrita no `member`:** direto na tabela, igual ao que `criar-usuario` já faz. O chamador não é membro da empresa-alvo, e por isso a api do Better Auth recusaria.

**Sai:**
- `POST /api/org/:orgId/usuarios/vincular`;
- o `vincularUsuarioSchema` do shared;
- o `VincularModal` do web;
- os testes dessa rota, que viram os testes da rota nova.

Criar, editar e remover usuário pela empresa continuam iguais.

## Seleção de empresa

- Já funciona assim:
  - a lista vem de `organization/list`, só com vínculo;
  - a troca vai por `organization/set-active` do Better Auth;
  - as rotas conferem `membroAtual`.
- Entra o teste que faltava: `set-active` para empresa sem vínculo é recusado, e a empresa ativa da sessão não muda. Vale também para super usuário.

## Web

- **Configurações:**
  - o layout deixa entrar quem é admin da empresa **ou** super usuário;
  - a aba **Vínculos** aparece só para super usuário;
  - o item Configurações do rodapé do menu aparece para quem é admin **ou** super.
- **Página `app/(app)/configuracoes/vinculos/page.tsx`:**
  - Busca (`?busca=`).
  - Lista de usuários: nome, e-mail, a etiqueta "super usuário" e as empresas com o papel de cada uma.
  - Em cada usuário:
    - "Vincular a uma empresa" abre um modal com empresa e papel;
    - em cada empresa da lista, um menu para mudar o papel ou desvincular (com `ConfirmBar`);
    - "Marcar como super usuário" ou "Tirar super usuário".
  - Os erros da api aparecem em `FormMessage`, com o texto exato.
- **Onde mora:** `modulos/conta/componentes/vinculos/` e `dados.ts`, com `getUsuariosAdmin(busca)` e `getEmpresas()`. Só componentes e tokens do kit.
- **Configurações › Usuários:** o botão "Vincular conta existente" sai.

## Testes (`apps/api/test/conta/`)

- Cada rota `/api/admin`:
  - o caminho feliz, como super;
  - 403 para dono de empresa e para membro comum;
  - 401 sem login.
- Travas:
  - desvincular o último dono dá 422, e o vínculo continua;
  - rebaixar o último dono dá 422;
  - tirar o super do último super dá 422;
  - vincular duas vezes dá 409.
- `tipo` não se muda sozinho: o update de perfil com `tipo: "super"` não muda nada.
- Seleção: `set-active` para empresa sem vínculo é recusado.
- `test/ajuda.ts` ganha um jeito de criar super usuário para o teste. Ele grava direto no PGlite, não no Neon.

## Conferência

- `npm run typecheck`, `lint`, `test` e `build` verdes.
- `drizzle-kit generate` produz exatamente uma migration, só com a coluna `tipo`.
- No banco de verdade, com autorização: rodar a migration, marcar o Arthur com `npm run super` e conferir a aba Vínculos no navegador.
