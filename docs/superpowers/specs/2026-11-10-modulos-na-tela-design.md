# Módulos na tela — design

**Data:** 2026-11-10
**Pedido:** "os módulos no front também, como por exemplo ter o módulo de animais, aonde vai ter tudo sobre animais, espécie, cadastro, histórico, grupo etc. Quero que faça para todas as funcionalidades, até para as que vão ser implementadas futuramente."

**Decisões do Arthur:**
- O menu lateral mostra os módulos, cada um com submenu.
- Telas e módulos que ainda não existem aparecem como "em breve", com uma página "em breve".

**Base:** a modularização do código (`2026-11-10-modularizacao-design.md`). As pastas `apps/web/src/modulos/<m>/` já existem.

## Objetivo

Quem usa o sistema vê o ERP organizado em módulos, e cada módulo reúne tudo do seu assunto. O mesmo registro serve para o que ainda vai ser construído: funcionalidade nova entra como tela do seu módulo e não como item solto no menu.

## Fora do escopo

- Construir as telas "em breve" (espécies, histórico geral, incubatório, estoque, financeiro). Cada uma é um projeto próprio.
- Mudar a api além do link do aviso (ver *Endereços*), o visual do kit ou o conteúdo das telas.

## Mapa de módulos

Os módulos e telas aparecem nesta ordem no menu.

| Módulo | Telas | Endereço |
|---|---|---|
| Início | sem submenu | `/dashboard` |
| Notas | sem submenu | `/notas` |
| Animais | Cadastro | `/animais` (ficha: `/animais/[id]`) |
| | Grupos | `/animais/grupos` |
| | Espécies, *em breve* | `/em-breve?tela=animais.especies` |
| | Histórico, *em breve* | `/em-breve?tela=animais.historico` |
| Aviário | Lotes, só quando a organização tem galpão | `/aviario/lotes` (ficha: `/aviario/lotes/[id]`) |
| | Galpões | `/aviario/galpoes` |
| | Incubatório, *em breve* | `/em-breve?tela=aviario.incubatorio` |
| Saúde | Agenda | `/saude/agenda` |
| | Prontuários | `/saude/prontuarios` |
| Estoque, *em breve* | sem submenu | `/em-breve?tela=estoque` |
| Financeiro, *em breve* | sem submenu | `/em-breve?tela=financeiro` |
| Relatórios | sem submenu | `/relatorios` |
| **Rodapé:** Configurações | só administrador, como hoje | `/configuracoes` (Conta, Usuários) |

Galpões sai de Configurações e vai para Aviário.

## Registro de módulos

Cada módulo do web declara o próprio menu em `src/modulos/<m>/menu.ts`. É só dado, seguro no cliente, e é exportado pelo `index.ts` do módulo. Os tipos e as funções do registro ficam em `src/lib/navigation.ts`, que substitui `NAV_ITEMS`:

```ts
type Tela = { id: string; rotulo: string; href: Route; emBreve?: true; soComInstalacao?: true };
type ModuloMenu = { id: string; rotulo: string; href?: Route; telas: Tela[]; emBreve?: true };
```

- **Regra de identificador:**
  - o `id` do módulo é o nome da pasta (`animais`);
  - o `id` da tela é `<modulo>.<tela>` (`animais.grupos`);
  - os dois são únicos.
- **Regra de "em breve":** tela em breve tem `href` igual a `/em-breve?tela=<id>`; módulo em breve não tem telas e tem `href` igual a `/em-breve?tela=<id>`.
- **Regra de módulo sem submenu:** é um `ModuloMenu` com `href` e `telas: []`.
- **Módulos que ainda não têm código:** `estoque` e `financeiro` ganham pasta, só com `menu.ts` e `index.ts`.
- **Início, Relatórios e Configurações:**
  - Início e Relatórios vêm de `painel`, que exporta dois itens;
  - Configurações vem de `conta`, como item de rodapé.
- **Ordem:** `navigation.ts` tem a lista `MENU` (a ordem da tabela acima) e `RODAPE`.

Funções puras em `navigation.ts`, com teste:
- `acharAtivo(pathname: string, telaEmBreve?: string | null): { modulo: ModuloMenu; tela: Tela | null } | null` devolve o módulo e a tela do endereço atual. `usePathname` não traz a query, então a página em breve passa o `?tela=` no segundo argumento.
  - A ficha (`/animais/[id]`) pertence à tela Cadastro.
  - A ficha do lote pertence a Lotes.
  - Em `/em-breve` com `telaEmBreve = x`, devolve o módulo e a tela de `x`.
- `menuVisivel(menu, { temInstalacao }): ModuloMenu[]` tira as telas `soComInstalacao` quando não há galpão.
- `validarMenu(menu): string[]` lista problemas: identificador repetido, tela em breve com `href` errado, `id` de tela sem o prefixo do módulo. O teste exige lista vazia.

## Menu lateral

- Cada módulo é um botão. Clicar abre ou fecha as telas dele.
  - O módulo da tela atual já vem aberto.
  - Módulo sem submenu é link direto.
- Tela ativa fica marcada, como hoje.
- A contagem de notas pendentes continua no item Notas.
- Tela ou módulo em breve aparece com texto apagado e a etiqueta "em breve", e continua clicável.
- Acessível:
  - o botão do módulo tem `aria-expanded` e `aria-controls`;
  - o link da tela atual tem `aria-current="page"`.

## Cabeçalho

O cabeçalho mostra onde a pessoa está: **Animais › Grupos**, ou só **Notas** quando o módulo não tem submenu. O texto vem de `acharAtivo(pathname)`. O título da página (`PageHeader`) continua como está.

## Página "em breve"

`app/(app)/em-breve/page.tsx`:
- lê `?tela=`;
- acha o item no registro;
- mostra o módulo, a tela e o texto "Esta parte do {BRAND_NAME} ainda está sendo construída.";
- `tela` desconhecida dá 404.

## Endereços

As páginas mudam de pasta em `app/(app)/`:

| Antes | Depois |
|---|---|
| `lotes/`, `lotes/[id]/` | `aviario/lotes/`, `aviario/lotes/[id]/` |
| `configuracoes/galpoes/` | `aviario/galpoes/` |
| `grupos/` | `animais/grupos/` |
| `agenda/` | `saude/agenda/` |
| `prontuarios/` | `saude/prontuarios/` |

Para favorito e link salvo em aviso continuarem funcionando, `next.config.ts` ganha redirecionamentos permanentes que levam a query junto:
- `/lotes` → `/aviario/lotes`
- `/lotes/:id` → `/aviario/lotes/:id`
- `/configuracoes/galpoes` → `/aviario/galpoes`
- `/grupos` → `/animais/grupos`
- `/agenda` → `/saude/agenda`
- `/prontuarios` → `/saude/prontuarios`

Os links internos (`Link`, `router.push`, links montados nos componentes) passam para o endereço novo; com `typedRoutes`, link para endereço que não existe quebra no typecheck. O aviso da api com `link: "/agenda"` passa a `"/saude/agenda"`, e o teste existente que conferir esse link é atualizado.

## Testes

- `src/lib/navigation.test.ts`:
  - `validarMenu(MENU)` vazio;
  - `acharAtivo` para `/animais/grupos`, `/animais/abc` (Cadastro), `/aviario/lotes/x` (Lotes), `/notas` (sem tela), `/em-breve` com `estoque` e endereço fora do menu (`null`);
  - `menuVisivel` sem galpão esconde Lotes e mantém Galpões.
- `next.config.test.ts`: cada redirecionamento da tabela, com query preservada (`/agenda?dia=2026-11-10`).
- O componente do menu fica fora, como manda o CLAUDE.md; a regra por trás dele está nas funções acima.

## Conferência

- `npm run typecheck`, `lint`, `test` e `build` verdes.
- No navegador, depois do login do Arthur:
  - abrir cada tela pelo menu;
  - abrir um item em breve;
  - abrir um endereço antigo (`/lotes`) e ver o redirecionamento.
