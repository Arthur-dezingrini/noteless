# Módulos na tela — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menu lateral por módulo, com submenu, e telas futuras "em breve", a partir de um registro que cada módulo do web declara.

**Architecture:**
- Cada `src/modulos/<m>/menu.ts` exporta dados, e `src/lib/navigation.ts` junta tudo na ordem e oferece funções puras (`acharAtivo`, `menuVisivel`, `validarMenu`).
- As páginas mudam para endereços por módulo. Os endereços antigos redirecionam em `next.config.ts`.

**Tech Stack:** Next.js 16 (App Router, `typedRoutes`; ler `apps/web/AGENTS.md`), React, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-modulos-na-tela-design.md`

## Global Constraints

- **Só no web,** com uma exceção: o `link: "/agenda"` da api (2 lugares em `apps/api/src/modulos/painel/rotas/inicio.ts`) passa a `"/saude/agenda"`.
- **Nada muda** no conteúdo das telas, no kit nem no texto de tela além do menu, do cabeçalho e da página em breve.
- **Mover páginas com `git mv`.** `git add` sempre por caminho, sem os arquivos do Arthur (`apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/avaliacao/`, `apps/api/src/modulos/notas/ia/avaliar.ts`, `apps/api/test/avaliar.test.ts`) e sem o `.claude/launch.json`.
- **Node 24:** `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`.
- **Gate de cada commit,** na raiz: `npm run typecheck && npm run lint && npm test`. A Task 3 também roda `npm run build -w @vocare/web`.
- **Rotas tipadas:** se o `.next/dev/types` estiver velho, apagar e rodar `npx next typegen` em `apps/web`.
- **Commit** direto na `main`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Texto da página em breve,** exato: `Esta parte do {BRAND_NAME} ainda está sendo construída.`

## Review Focus

1. **`proxy.ts` tem lista de caminhos protegidos.** Os novos (`/aviario`, `/saude`, `/em-breve`, `/animais/grupos`) precisam estar nela, senão quem não está logado vê a página em vez de ir ao login. Task 2 cobre.
2. **Redirecionamento que perde a query.** `/agenda?dia=…` precisa chegar com `?dia=…`. Os testes da Task 2 cobrem.
3. **`/animais/grupos` contra `/animais/[id]`.** O segmento fixo vence o dinâmico no Next, então `grupos` nunca é tratado como id. O teste de `acharAtivo` cobre: `/animais/grupos` dá Grupos, e não Cadastro.
4. **Menu fechado escondendo a tela atual.** O módulo da tela atual abre sozinho, inclusive na ficha (`/aviario/lotes/x`). Coberto por `acharAtivo`.
5. **Item em breve que leva a um 404.** Coberto por `validarMenu`, que exige o `href` `/em-breve?tela=<id>`, e pela página, que devolve 404 só para id desconhecido.

---

### Task 1: registro de módulos e funções de navegação

**Files:**
- Create:
  - `apps/web/src/modulos/{notas,animais,aviario,saude,painel,conta}/menu.ts`
  - `apps/web/src/modulos/{estoque,financeiro}/menu.ts` e `index.ts`
  - `apps/web/src/lib/navigation.test.ts`
- Modify:
  - `apps/web/src/lib/navigation.ts`, que é reescrito;
  - o `index.ts` de cada módulo, para exportar o `menu`.

**Interfaces (Produces):**
```ts
// lib/navigation.ts
export type Tela = { id: string; rotulo: string; href: Route; emBreve?: true; soComInstalacao?: true };
export type ModuloMenu = { id: string; rotulo: string; href?: Route; telas: Tela[]; emBreve?: true };
export const MENU: ModuloMenu[];      // ordem da spec
export const RODAPE: ModuloMenu[];    // [configurações]
export function emBreve(id: string): Route;                 // `/em-breve?tela=${id}` as Route
export function acharAtivo(pathname: string, telaEmBreve?: string | null): { modulo: ModuloMenu; tela: Tela | null } | null;
export function menuVisivel(menu: ModuloMenu[], o: { temInstalacao: boolean }): ModuloMenu[];
export function validarMenu(menu: ModuloMenu[]): string[];
```

**Menus:**
- `painel/menu.ts` exporta `inicio` (`/dashboard`) e `relatorios` (`/relatorios`).
- `conta/menu.ts` exporta `configuracoes` (`/configuracoes`, sem telas).
- Os outros exportam `menu`.
- `MENU = [inicio, notas, animais, aviario, saude, estoque, financeiro, relatorios]`.
- Os ids e endereços de tela são os da tabela da spec. Lotes e Galpões já usam os endereços novos (`/aviario/lotes`, `/aviario/galpoes`). Como as páginas só mudam na Task 2, nesta task esses `href` entram com `as Route`, e o cast sai na Task 2.

**Como `acharAtivo` resolve:**
- **`/em-breve`:** procura pelo `id` igual a `telaEmBreve`, seja tela ou módulo.
- **Os outros endereços:** casa a tela de `href` mais longo que seja igual ao caminho ou prefixo de `caminho + "/"`. Comparar só a parte sem query do `href`.
- **Sem tela casada:** tenta o `href` do módulo da mesma forma.

- [ ] **Step 1: Escrever `navigation.test.ts`:**
  ```ts
  it("o menu não tem problema", () => expect(validarMenu([...MENU, ...RODAPE])).toEqual([]));
  it("acusa id repetido e em breve com href errado", () => {
    const m: ModuloMenu = { id: "x", rotulo: "X", telas: [
      { id: "x.a", rotulo: "A", href: "/dashboard" },
      { id: "x.a", rotulo: "A2", href: "/notas" },
      { id: "x.b", rotulo: "B", href: "/notas", emBreve: true },
      { id: "y.c", rotulo: "C", href: "/notas" },
    ] };
    expect(validarMenu([m])).toHaveLength(3);
  });
  it.each([
    ["/animais/grupos", "animais", "animais.grupos"],
    ["/animais/abc-123", "animais", "animais.cadastro"],
    ["/animais", "animais", "animais.cadastro"],
    ["/aviario/lotes/l1", "aviario", "aviario.lotes"],
    ["/saude/agenda", "saude", "saude.agenda"],
    ["/notas", "notas", null],
    ["/dashboard", "inicio", null],
  ])("acharAtivo(%s)", (caminho, modulo, tela) => {
    const a = acharAtivo(caminho);
    expect(a?.modulo.id).toBe(modulo);
    expect(a?.tela?.id ?? null).toBe(tela);
  });
  it("página em breve acha módulo e tela pelo ?tela=", () => {
    expect(acharAtivo("/em-breve", "animais.especies")?.tela?.rotulo).toBe("Espécies");
    expect(acharAtivo("/em-breve", "estoque")?.modulo.rotulo).toBe("Estoque");
    expect(acharAtivo("/em-breve", "nada")).toBeNull();
  });
  it("endereço fora do menu", () => expect(acharAtivo("/perfil")).toBeNull());
  it("sem galpão, Aviário fica só com Galpões e Incubatório", () => {
    const av = menuVisivel(MENU, { temInstalacao: false }).find((m) => m.id === "aviario")!;
    expect(av.telas.map((t) => t.id)).toEqual(["aviario.galpoes", "aviario.incubatorio"]);
  });
  ```
  Observação: a ordem das telas do Aviário é Lotes, Galpões, Incubatório; sem galpão some só a primeira.

- [ ] **Step 2: Rodar e ver falhar.** `cd apps/web && npx vitest run src/lib/navigation.test.ts` → FAIL (funções não existem).
- [ ] **Step 3: Implementar** os `menu.ts`, o `navigation.ts` e os exports nos `index.ts`.
  - O sidebar continua compilando nesta task: ele passa a usar um `NAV_ITEMS` derivado provisório, ou é adaptado já na Task 3. A escolha mais simples é manter, até a Task 3, uma lista plana (`MENU.flatMap`) com o mesmo formato de antes.
- [ ] **Step 4: Rodar e ver passar.** Depois, o gate.
- [ ] **Step 5: Commit** `web: registro de módulos do menu (com telas em breve)`.

---

### Task 2: páginas nos endereços por módulo e redirecionamentos

**Files:**
- Move (`git mv`) em `apps/web/src/app/(app)/`:
  - `lotes/` → `aviario/lotes/`
  - `configuracoes/galpoes/` → `aviario/galpoes/`
  - `grupos/` → `animais/grupos/`
  - `agenda/` → `saude/agenda/`
  - `prontuarios/` → `saude/prontuarios/`
- Modify:
  - `apps/web/next.config.ts` e `apps/web/next.config.test.ts`;
  - `apps/web/src/proxy.ts`, a lista de caminhos protegidos;
  - os links internos;
  - `apps/api/src/modulos/painel/rotas/inicio.ts` e o teste da api que conferir esse link, se houver (`rg '"/agenda"' apps/api/test`).

Links internos a trocar (lista do `rg` no planejamento):
- `/agenda` em `inicio.tsx`, `relatorios-view.tsx` e `prontuarios-view.tsx`;
- `/prontuarios` em `ficha-view.tsx`, `linha-consulta.tsx` e `prontuarios-view.tsx`;
- `/lotes` em `lotes-lista.tsx`, `ficha-lote.tsx` e `galpoes-hoje.tsx`;
- o item "Galpões" de `config-nav.tsx`, que sai;
- os `PageProps<"/agenda">`, `<"/lotes">` e `<"/prontuarios">` das páginas.

- [ ] **Step 1: Teste de redirecionamento** em `next.config.test.ts`:
  ```ts
  it.each([
    ["/lotes", "/aviario/lotes"],
    ["/lotes/abc", "/aviario/lotes/abc"],
    ["/configuracoes/galpoes", "/aviario/galpoes"],
    ["/grupos", "/animais/grupos"],
    ["/agenda?dia=2026-11-10", "/saude/agenda?dia=2026-11-10"],
    ["/prontuarios?id=p1", "/saude/prontuarios?id=p1"],
  ])("%s vai para %s", async (de, para) => {
    const res = await abrir(de);
    expect(res.status).toBe(308);
    expect(getRedirectUrl(res)).toBe(`http://localhost:3000${para}`);
  });
  ```
- [ ] **Step 2: Rodar e ver falhar.** `cd apps/web && npx vitest run next.config.test.ts`.
- [ ] **Step 3: Implementar.**
  - Mover as páginas.
  - Adicionar os redirecionamentos (`permanent: true`) e trocar os links.
  - Tirar os `as Route` dos `href` de `aviario/menu.ts`.
  - Pôr `/aviario`, `/saude` e `/em-breve` na lista do `proxy.ts`. `/animais/grupos` já está coberto se a lista usa prefixo `/animais`; conferir.
  - Trocar o link da api.
- [ ] **Step 4: Gate.**
- [ ] **Step 5: Commit** `web: telas nos endereços dos módulos; endereços antigos redirecionam`.

---

### Task 3: menu lateral com submenu, cabeçalho e página em breve

**Files:**
- Modify:
  - `apps/web/src/components/app/sidebar.tsx`;
  - `apps/web/src/components/app/header.tsx`;
  - `apps/web/src/app/(app)/layout.tsx`, se precisar repassar algo.
- Create: `apps/web/src/app/(app)/em-breve/page.tsx`.

**Interfaces:** usa `MENU`, `RODAPE`, `menuVisivel`, `acharAtivo` e `emBreve` da Task 1.

- [ ] **Step 1: Sidebar.**
  - Renderiza `menuVisivel(MENU, { temInstalacao })`, que substitui o filtro `soComInstalacao`.
  - Módulo com telas: um `<button aria-expanded aria-controls>`, com chevron, e abaixo a lista das telas.
    - O estado aberto começa com o módulo de `acharAtivo(pathname, searchParams.get("tela"))`.
    - O módulo da tela atual sempre abre quando o `pathname` muda.
  - Módulo sem telas: link direto, como os itens de hoje.
  - A contagem `pendentes` fica no item `notas`.
  - Em breve: classe `text-ink-muted`, mais a etiqueta `em breve` em `text-[12px]`.
  - A tela ativa usa o estilo ativo de hoje e `aria-current="page"`.
  - O rodapé fica igual, com `RODAPE`, só para administrador.
  - Usar só tokens e componentes do kit, nada de cor nova.
- [ ] **Step 2: Cabeçalho.**
  - À esquerda, o texto `Módulo › Tela`, ou só o módulo quando não há tela, vindo de `acharAtivo`.
  - Classe `text-[15px] text-ink-muted`, com a tela em `text-ink font-semibold`.
  - Fora do menu (perfil), não mostra nada.
  - O `justify-end` vira `justify-between`.
- [ ] **Step 3: Página em breve.**
  - `searchParams.tela` → `acharAtivo("/em-breve", tela)`, e `notFound()` se for null.
  - Mostra `PageHeader` com `eyebrow` = rótulo do módulo e `title` = rótulo da tela (ou do módulo), e um `Card` com o texto exato das Global Constraints.
  - Exige sessão (`requireSession`), como as outras páginas.
- [ ] **Step 4: Gate + build:** `npm run typecheck && npm run lint && npm test && npm run build -w @vocare/web`.
- [ ] **Step 5: Commit** `web: menu lateral por módulo, caminho no cabeçalho e página em breve`.

---

### Task 4: conferência e CLAUDE.md

- [ ] **Step 1: CLAUDE.md,** seção "Estrutura por módulo": uma linha dizendo que cada módulo do web declara o menu em `menu.ts`, que tela futura entra com `emBreve`, e que módulo novo é uma pasta com `menu.ts` registrada em `MENU`.
- [ ] **Step 2: Navegador.**
  - Subir `vocare-dev` pelo preview.
  - Sem login, `/aviario/lotes` → login.
  - Com o login do Arthur:
    - abrir cada tela pelo menu;
    - abrir um item em breve;
    - abrir `/lotes` e ver o redirecionamento;
    - conferir o caminho no cabeçalho;
    - testar em largura de celular, onde o menu continua usável.
- [ ] **Step 3: Commit** `docs: menu por módulo no CLAUDE.md`.
