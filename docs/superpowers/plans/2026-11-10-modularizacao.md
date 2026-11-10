# Modularização por domínio — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar api, web e shared por módulo de domínio, com o mesmo esqueleto em todos e sem mudar o comportamento.

**Architecture:**
- Cada módulo (`aviario`, `notas`, `animais`, `saude`, `conta`, `avisos`, `painel`) ganha pasta própria em `apps/api/src/modulos/`, `apps/web/src/modulos/` e `packages/shared/src/`.
- As tabelas ficam em `apps/api/src/db/tabelas/<modulo>.ts`.
- Um módulo só importa outro pela porta de entrada, e um teste de estrutura em cada app garante isso.

**Tech Stack:** Hono, Drizzle (Postgres; PGlite nos testes), Next.js 16 (App Router; ler `apps/web/AGENTS.md`), Zod, Vitest, Turborepo.

**Spec:** `docs/superpowers/specs/2026-11-10-modularizacao-design.md`

## Global Constraints

- **Zero mudança de comportamento.** Ficam iguais:
  - as rotas HTTP, com caminhos, status e corpos;
  - as mensagens de erro;
  - os contratos Zod exportados por `@vocare/shared`;
  - o texto das telas;
  - o SQL das tabelas.
- **Testes existentes** só mudam de pasta e de caminho de import, nunca de asserção.
- **Mover com `git mv`,** para o histórico seguir o arquivo.
- **Ficam onde estão:**
  - `src/app.ts`, `src/index.ts`, `src/env.ts`, `src/load-env.ts`, `src/auth.ts`;
  - `src/db/index.ts`, `src/db/schema.ts` (gerado; não editar), `src/db/seed.ts`;
  - `components/ui`, `components/app`, `lib/api.ts`, `lib/api-client.ts`, `lib/brand.ts`, `lib/navigation.ts`, `lib/datas.ts`, `lib/json.ts`;
  - `test/ajuda.ts`, `test/setup.ts`.
- **Nunca commitar nem reformatar** `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/avaliacao/`, `apps/api/src/ia/avaliar.ts` e `apps/api/test/avaliar.test.ts`. São trabalho em andamento do Arthur e o `git add` é sempre por caminho explícito, nunca `git add -A` ou `.`.
- **Nada de dependência nova.** Nada de prettier em arquivo que o passo não move.
- **Um commit por task,** direto na `main`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Node 24:** `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"` antes de qualquer `npm`/`npx`.
- **Gate de cada commit,** na raiz: `npm run typecheck && npm run lint && npm test`, todos verdes.
- **Gate das tasks que movem tabela:** em `apps/api`, rodar `npx drizzle-kit generate`. Ele precisa responder "No schema changes" e não criar arquivo em `drizzle/`; se criar, apagar o arquivo e corrigir. O comando não toca no banco.
- **Identificadores em português,** como o resto do código. Nenhum texto de tela muda.

## Decisões tomadas ao planejar

As decisões abaixo ajustam ou detalham a spec.

1. **Todas as tabelas mudam de lugar na Task 1,** e não módulo a módulo. A spec põe as tabelas numa camada comum, então movê-las de uma vez dá uma única checagem do Drizzle. O custo, se estiver errado, é nenhum: os caminhos são os mesmos.
2. **No web, a porta de entrada de um módulo são dois arquivos:**
   - `@/modulos/<m>`, o `index.ts`, com componentes e tipos seguros no cliente;
   - `@/modulos/<m>/dados`, com as funções server-only.

   O `dados.ts` importa `lib/api.ts` (`server-only`); se fosse re-exportado pelo `index.ts`, componentes client que importam o módulo puxariam código de servidor. O teste de estrutura aceita as duas entradas.
3. **No web, `app/` também é checado:** página e layout só importam módulo pelas duas entradas acima.
4. **Rota com bloco de transação ou de regra acima de ~15 linhas** move esse bloco para uma função em `regras/`. A função devolve `Resultado<T>`, definido em `src/base/resultado.ts` (Task 1). A rota só traduz para `c.json(...)`. Mensagens e status passam a viver na regra, idênticos aos de hoje.

## Review Focus

As cinco falhas que os testes não pegam e que mais afetariam quem usa o sistema:

1. **Componente client importando código server-only** pela porta errada. O typecheck passa, mas o build do Next quebra. Por isso o `npm run build` roda nas Tasks 2 e 9, e o teste de estrutura do web recusa import de `dados` em arquivo com `"use client"`.
2. **Tabela esquecida no `drizzle.config.ts`.** A próxima migration tentaria dropar a tabela. Guardado pelo gate do `drizzle-kit generate` (Task 1).
3. **`index.ts` que re-exporta as rotas e também é importado por outro módulo** cria ciclo de import na inicialização: uma rota fica `undefined` e o Hono sobe sem ela. Guardado pelo teste de ciclo (Task 1) e pelos testes de rota.
4. **Página do Next que perde `cache()` ou `await`** ao trocar `@/lib/auth/dal` por `dados.ts`. A tela fica em branco sem erro de tipo. As funções movidas mantêm o `cache(...)` de hoje, sem reescrever o corpo, e a Task 9 abre cada tela no navegador.
5. **Mensagem de erro alterada ao mover lógica para `regras/`.** Os testes de rota comparam as mensagens exatas de hoje; nenhum teste é afrouxado.

---

### Task 1: base, tabelas e teste de estrutura

**Files:**
- Move (`git mv`):
  - `apps/api/src/datas.ts` → `apps/api/src/base/datas.ts`
  - `apps/api/src/membros/membro-atual.ts` → `apps/api/src/base/membro-atual.ts`
  - `db/lotes.ts` → `db/tabelas/aviario.ts`
  - `db/ocorrencias.ts` → `db/tabelas/notas.ts`
  - `db/animais.ts` → `db/tabelas/animais.ts`
  - `db/consultas.ts` → `db/tabelas/saude.ts`
  - `db/historico.ts` → `db/tabelas/animais-historico.ts`; o conteúdo depois é juntado em `animais.ts` (ver o passo de tabelas)
- Create:
  - `apps/api/src/base/resultado.ts`
  - `apps/api/src/db/tabelas/avisos.ts`, com a tabela `notificacao` saída de `historico`
  - `apps/api/test/estrutura.test.ts`
  - `apps/web/src/modulos/estrutura.test.ts`
- Modify: `apps/api/drizzle.config.ts` e todos os imports que apontavam para os caminhos movidos.

**Interfaces:**
- Produces:
  - `type Resultado<T> = { ok: true; valor: T } | { ok: false; status: 400 | 403 | 404 | 409 | 413 | 422; erro: string }`
  - `ok<T>(valor: T): Resultado<T>` e `falha(status, erro): Resultado<never>`, em `src/base/resultado.ts`
  - `hojeISO`, `dataISOEmSP`, `noDia`, `br`, em `src/base/datas.ts`
  - `membroAtual`, em `src/base/membro-atual.ts`
  - as tabelas, com os mesmos nomes exportados, em `src/db/tabelas/{aviario,notas,animais,saude,avisos}.ts`
  - `acharViolacoes(arquivos: { caminho: string; conteudo: string }[]): string[]` e `acharCiclos(arquivos): string[][]`, definidas dentro de cada teste de estrutura

- [ ] **Step 1: Escrever `apps/api/test/estrutura.test.ts`**
  - Lê, com `fs`, todo `.ts` de `src/` (exceto `db/schema.ts`).
  - Extrai os especificadores de `from "…"` e `import("…")` e resolve os relativos a partir da pasta do arquivo.
  - O módulo de um arquivo é o segmento depois de `src/modulos/`; `src/base/` é "base".
  - **Violação** é:
    - um arquivo do módulo A importar `src/modulos/B/<qualquer coisa além de index>`, com B ≠ A;
    - um arquivo de `base/` importar `src/modulos/`;
    - arquivo fora de `modulos/` (`app.ts`, `db/seed.ts`) importar `src/modulos/B/...` que não seja o index.
  - **Ciclo** é ciclo no grafo módulo → módulo.

  Casos:
  ```ts
  it("acusa import que passa do index de outro módulo", () => {
    expect(acharViolacoes([{ caminho: "src/modulos/notas/rotas.ts", conteudo: 'import { x } from "../aviario/regras/aplicar";' }]))
      .toEqual(["src/modulos/notas/rotas.ts → src/modulos/aviario/regras/aplicar"]);
  });
  it("aceita import pelo index e dentro do próprio módulo", () => {
    expect(acharViolacoes([
      { caminho: "src/modulos/notas/rotas.ts", conteudo: 'import { x } from "../aviario";\nimport { y } from "./regras/aplicar";' },
    ])).toEqual([]);
  });
  it("acusa base importando módulo", () => {
    expect(acharViolacoes([{ caminho: "src/base/datas.ts", conteudo: 'import { x } from "../modulos/aviario";' }])).toHaveLength(1);
  });
  it("acusa ciclo entre módulos", () => {
    expect(acharCiclos([
      { caminho: "src/modulos/a/index.ts", conteudo: 'import "../b";' },
      { caminho: "src/modulos/b/index.ts", conteudo: 'import "../a";' },
    ])).toHaveLength(1);
  });
  it("o código real segue o padrão", () => {
    const arquivos = lerSrc();
    expect(acharViolacoes(arquivos)).toEqual([]);
    expect(acharCiclos(arquivos)).toEqual([]);
  });
  ```

- [ ] **Step 2: Escrever `apps/web/src/modulos/estrutura.test.ts`**

  Tem a mesma forma do teste da api, com estas diferenças:
  - lê `apps/web/src/**/*.{ts,tsx}`;
  - resolve `@/` para `src/`;
  - as entradas aceitas de um módulo B são `src/modulos/B` (index) e `src/modulos/B/dados`;
  - também é violação um arquivo cujo conteúdo começa com `"use client"` importar `…/dados`.

  Casos equivalentes aos 5 da api, mais:
  ```ts
  it("acusa componente client importando dados", () => {
    expect(acharViolacoes([{ caminho: "src/modulos/notas/componentes/lista.tsx", conteudo: '"use client";\nimport { getLotes } from "@/modulos/aviario/dados";' }])).toHaveLength(1);
  });
  ```

- [ ] **Step 3: Rodar os dois testes.** Os testes sintéticos passam e o caso real passa (ainda não há `modulos/`).

  Para provar que o teste pega o erro: plantar `src/modulos/x/a.ts` com `import "../y/regras/z";` e ver o caso real falhar. Depois apagar.

  Run: `cd apps/api && npx vitest run test/estrutura.test.ts` e `cd apps/web && npx vitest run src/modulos/estrutura.test.ts`

- [ ] **Step 4: Mover `datas.ts` e `membro-atual.ts` para `base/` e criar `resultado.ts`.**
  - Atualizar os imports em `src/` e `test/`.
  - `rg -l '"\.\./datas"|membros/membro-atual'` deve sair vazio, e a pasta `membros/` some.
  - O `src/ia/avaliar.ts`, que não é commitado, não importa esses dois.

- [ ] **Step 5: Mover as tabelas.**
  - `db/historico.ts`:
    - `notificacao` (e os imports que só ela usa) vai para `db/tabelas/avisos.ts`;
    - o resto (`pesagem`, `vacina`, `tratamento`, `parto`, `grupo`, `grupoAnimal`) é juntado ao fim de `db/tabelas/animais.ts`;
    - `historico.ts` deixa de existir.
  - `drizzle.config.ts` → `schema: ["./src/db/schema.ts", "./src/db/tabelas/*.ts"]`.
  - Atualizar todos os imports, inclusive os de `test/`.
  - Os arquivos `avaliacao/casos.ts` e `avaliacao/rodar.ts`, que não são commitados, não importam tabelas e ficam como estão.

- [ ] **Step 6: Gate.**
  - Na raiz: `npm run typecheck && npm run lint && npm test`.
  - Em `apps/api`: `npx drizzle-kit generate` → "No schema changes", e `git status drizzle/` limpo.

- [ ] **Step 7: Commit**
  ```bash
  git add apps/api/src/base apps/api/src/db apps/api/drizzle.config.ts apps/api/test/estrutura.test.ts apps/web/src/modulos/estrutura.test.ts <cada arquivo cujo import mudou>
  git commit -m "estrutura: base, tabelas por módulo e teste que guarda o padrão"
  ```

---

### Task 2: módulo `aviario` (modelo do padrão)

**Files:**

*api*
- `routes/lotes.ts` →
  - `modulos/aviario/rotas/galpoes.ts`: GET/POST/PATCH `instalacoes` e GET `galpoes-hoje`; `listarInstalacoes` e `nomeRepetido` vão para `consultas/instalacoes.ts`.
  - `modulos/aviario/rotas/lotes.ts`: GET/POST `lotes`, GET `lotes/:id`, `transferir`, `fase`, `encerrar`, `desfazer-transferencia`, `reabrir`.
  - `modulos/aviario/rotas/registros.ts`: PUT `apontamentos`, POST `pesagens` e `vacinacoes`.
  - `modulos/aviario/rotas/index.ts`: `export const aviarioRotas = new Hono().route("/", galpoes).route("/", lotes).route("/", registros)`.
- `lotes/{alojamento,apontamento,aplicar}.ts` → `modulos/aviario/regras/`, mais o arquivo novo `regras/lotes.ts`.
- `lotes/{ficha,resumo,galpoes-ia}.ts` → `modulos/aviario/consultas/`.
- `acharLote` → `consultas/lotes.ts`.
- `modulos/aviario/index.ts`.
- `test/lotes.test.ts` → `test/aviario/lotes.test.ts`.
- `app.ts` passa a fazer `app.route("/api/org", aviarioRotas)` no lugar de `lotesRoutes`, na mesma posição da lista.

*shared*
- `lotes.ts`, `lotes.test.ts`, `indicadores-lote.ts`, `indicadores-lote.test.ts` → `packages/shared/src/aviario/`.
- Novo `aviario/index.ts`.
- `src/index.ts` troca as duas linhas por `export * from "./aviario";`.
- Ajustar os imports `./…` internos, como `ocorrencias.ts` → `./aviario`.

*web*
- `app/(app)/lotes/{lotes-lista,alojar-modal}.tsx`, `lotes/[id]/{ficha-lote,apontamento-modal,acoes-lote}.tsx` e `configuracoes/galpoes/galpoes-lista.tsx` → `modulos/aviario/componentes/`.
- `acoes-lote.tsx` é quebrado em `componentes/acoes/`:
  - `modal-acao.tsx` (`ModalAcao`, `Base`);
  - `transferir.tsx` (`TransferirModal`, `vivasNoGalpao`);
  - `fase.tsx`;
  - `desfazer.tsx`;
  - `encerrar.tsx`;
  - `pesagem.tsx`;
  - `vacina.tsx`;
  - `index.ts`.
- `ficha-lote.tsx` é quebrado em `componentes/ficha/`:
  - `ficha-lote.tsx` (`FichaLote`, `ABAS`, `Acao`);
  - `diario.tsx`;
  - `semanal.tsx`;
  - `pesagens.tsx`;
  - `vacinas.tsx`.
- O bloco "Galpões hoje" de `dashboard/page.tsx` vira `componentes/galpoes-hoje.tsx`, que recebe `galpoes: GalpaoHoje[]` por props e é server component.
- `modulos/aviario/dados.ts` recebe `getInstalacoes`, `getGalpoesHoje`, `getLotes`, `getLote`, tirados do `dal.ts` com corpo e `cache` intactos.
- `modulos/aviario/index.ts`.
- As páginas `lotes/page.tsx`, `lotes/[id]/page.tsx`, `configuracoes/galpoes/page.tsx`, `dashboard/page.tsx` e o `(app)/layout.tsx`, que usa `getInstalacoes`, passam a importar de `@/modulos/aviario` e `@/modulos/aviario/dados`.

**Interfaces:**
- Consumes: `Resultado`/`ok`/`falha`, `membroAtual` e `hojeISO` da Task 1.
- Produces:
  - `modulos/aviario/index.ts` (api) exporta `aviarioRotas`, `aplicarAviario`, `galpoesDaOrg` e `type GalpaoParaIa`.
  - O tipo `GalpaoParaIa` passa a ser declarado em `consultas/galpoes-ia.ts`. `src/ia/analisar.ts` o importa de `../modulos/aviario` e não o declara mais. `avaliacao/` só usa `AnimalParaIa` e `GrupoParaIa`, que continuam em `analisar.ts`.
  - `regras/lotes.ts` exporta `criarLote`, `transferirLote`, `encerrarLote`, `desfazerTransferencia` e `reabrirLote`. Cada uma é `(orgId: string, loteId: string, dados) => Promise<Resultado<…>>` e recebe só o que a rota já validou com o schema do shared.
  - `modulos/aviario/index.ts` (web) exporta os componentes usados pelas páginas.

- [ ] **Step 1: shared.** Mover os arquivos com `git mv`, criar os index e ajustar os imports. Gate: `cd packages/shared && npx vitest run`, com os 58 testes passando.

- [ ] **Step 2: api, mover sem mudar conteúdo.**
  - `git mv` de `lotes/*` para `regras/` e `consultas/`, e de `test/lotes.test.ts` para `test/aviario/` (imports `../../src/...`, `../ajuda`).
  - Gate: `cd apps/api && npx vitest run test/aviario`.

- [ ] **Step 3: api, dividir a rota.**
  - `git mv routes/lotes.ts modulos/aviario/rotas/lotes.ts` e depois recortar em três arquivos.
  - Os blocos de transação de `POST lotes`, `transferir`, `encerrar`, `desfazer-transferencia` e `reabrir` vão para `regras/lotes.ts`. A rota só faz `const r = await transferirLote(...); return r.ok ? c.json(r.valor) : c.json({ error: r.erro }, r.status);`.
  - O formato de sucesso (status 200/201 e corpo) é exatamente o que cada rota devolve hoje.

- [ ] **Step 4: api, index e `app.ts`.** `routes/ocorrencias.ts`, que só muda na Task 3, passa a importar `aplicarAviario` e `galpoesDaOrg` de `../modulos/aviario`. Gate: `cd apps/api && npx vitest run`, com a suíte inteira verde.

- [ ] **Step 5: web, mover e dividir.**
  - `git mv` para `modulos/aviario/componentes/` e recorte de `acoes-lote` e `ficha-lote` nos arquivos listados.
  - Mover os 4 `get*` para `dados.ts` e apagá-los do `dal.ts`, junto com os imports que ficarem sem uso.
  - Atualizar as páginas.

- [ ] **Step 6: Gate.** Na raiz: `npm run typecheck && npm run lint && npm test && npm run build -w @vocare/web`.

- [ ] **Step 7: Commit**
  ```bash
  git commit -m "aviário: módulo próprio na api, no web e no shared"
  ```
  O `git add` é dos caminhos novos e antigos (renomes), de `app.ts`, `index.ts` do shared, `dal.ts` e páginas.

---

### Task 3: módulo `notas`

**Files:**

*api*
- `routes/ocorrencias.ts` →
  - `modulos/notas/rotas.ts`: as 8 rotas.
  - `modulos/notas/regras/aplicar.ts`: `aplicar`, `alvos`, `somarDias`, `AplicacaoFalhou`, `HORA_PADRAO`.
  - `modulos/notas/regras/gravacao.ts`: `quandoFoiGravado`, `ADIANTADO_MAX_MS`, `IDADE_MAX_MS`.
  - `modulos/notas/consultas.ts`: `paraContrato`, `buscar`, `gruposDaOrg`, `animaisDaOrg`, `donoSeOutro`.
- `ia/{analisar,transcrever,provedor}.ts` → `modulos/notas/ia/`.
- `index.ts` com `notasRotas`.
- Testes: `ocorrencias.test.ts`, `ocorrencias-aviario.test.ts`, `analisar-aviario.test.ts`, `gravacao.test.ts` e `acesso.test.ts` (se testar notas; se for transversal, fica em `test/`) → `test/notas/`.
- Nos `vi.mock("../src/ia/...")`, atualizar o caminho para o novo.

*Trabalho do Arthur, sem commitar*
- `git mv` não serve, porque os arquivos não são rastreados: usar `mv src/ia/avaliar.ts src/modulos/notas/ia/avaliar.ts`.
- Atualizar só as linhas de import de:
  - `test/avaliar.test.ts` (`../src/modulos/notas/ia/avaliar`);
  - `avaliacao/rodar.ts` e `avaliacao/casos.ts` (`../src/modulos/notas/ia/...`).
- Nenhuma outra linha muda e nada disso entra no `git add`.

*shared*
- `ocorrencias.ts` e `ocorrencias.test.ts` → `shared/src/notas/`, mais `index.ts`.

*web*
- `notas/notas-view.tsx` → `modulos/notas/componentes/`:
  - `notas-view.tsx` (`NotasView`, `ABAS`, `VAZIO`);
  - `item-lista.tsx`;
  - `detalhe.tsx` (`Detalhe`);
  - `audio.tsx`;
  - `operacao/linha-operacao.tsx` (`LinhaOperacao`);
  - `operacao/campos-editaveis.tsx` (`CamposEditaveis`, `opcoesDe`, `formatarCampo`);
  - `operacao/descricao.ts` (funções puras `nomeAlvo`, `deAlvo`, `juntar`, `efeito`, `camposDe`, `opcional`, `ehAviario`, `diaMes`, `naoEntendido`, `rotulo`, `LIMIAR_ATENCAO`);
  - `tipos.ts` (`AnimalRef`, `GrupoRef`, `GalpaoRef`, `LoteRef`, `Cadastro`, `Correcao`).
- `getOcorrencias` → `modulos/notas/dados.ts`.
- `app/(app)/notas/page.tsx` e `(app)/layout.tsx` atualizados.

**Interfaces:**
- Consumes: `aplicarAviario`, `galpoesDaOrg`, `GalpaoParaIa` de `../aviario` (porta de entrada).
- Consumes: `notificar` e `administradores` de `src/notificacoes/notificar.ts`, que ainda está no lugar antigo (vira `../avisos` na Task 7).
- Produces: `notasRotas`; `modulos/notas/index.ts` (api) exporta também `analisar`, `transcrever` e `IaNaoConfigurada`, se outro módulo precisar.

- [ ] **Step 1: shared.** Mover e criar o index. Gate: `cd packages/shared && npx vitest run`.
- [ ] **Step 2: api.** Mover `ia/` e mover os testes, com mocks e imports atualizados. Gate: `npx vitest run test/notas`.
- [ ] **Step 3: api.** Dividir a rota como descrito, com o mesmo cuidado com mensagens e status da Task 2. Trocar no `app.ts`. Gate: `npx vitest run`.
- [ ] **Step 4: Trabalho do Arthur.** Mover `avaliar.ts` e atualizar os imports. Gate: `npx vitest run test/avaliar.test.ts` passa e `git status --short` continua mostrando esses arquivos como `??`/` M`, nunca staged.
- [ ] **Step 5: web.** Dividir `notas-view.tsx` e mover `getOcorrencias`.
- [ ] **Step 6: Gate.** Na raiz: `npm run typecheck && npm run lint && npm test`.
- [ ] **Step 7: Commit** `notas: módulo próprio na api, no web e no shared`.

---

### Task 4: módulo `animais`

**Files:**
- *api*
  - `routes/{animais,ficha,grupos}.ts` → `modulos/animais/rotas/`.
  - Bloco de regra acima de ~15 linhas vai para `regras/` (decisão 4).
  - `index.ts` com `animaisRotas` (junta os três).
  - `test/animais.test.ts` → `test/animais/`.
- *shared:* `animais.ts`, `animais.test.ts`, `ficha.ts`, `grupos.ts` → `shared/src/animais/`.
- *web*
  - `app/(app)/animais/{animais-lista,animal-modal}.tsx`, `animais/[id]/ficha-view.tsx` e `grupos/grupos-view.tsx` → `modulos/animais/componentes/`.
  - `grupos-view.tsx` é quebrado em `grupos/grupos-view.tsx`, `grupos/grupo-modal.tsx` e `grupos/membro-modal.tsx`.
  - `getAnimais`, `getFicha`, `getGrupos` → `dados.ts`.
  - Atualizar `animais/page.tsx`, `animais/[id]/page.tsx`, `grupos/page.tsx` e `(app)/layout.tsx`.

**Interfaces:** Produces `animaisRotas`; o `index.ts` do web exporta os componentes das páginas.

- [ ] **Step 1:** shared, mover e gate.
- [ ] **Step 2:** api, mover, dividir, `app.ts` e gate `npx vitest run`.
- [ ] **Step 3:** web, mover, dividir e páginas.
- [ ] **Step 4:** Gate da raiz.
- [ ] **Step 5:** Commit `animais: módulo próprio na api, no web e no shared`.

---

### Task 5: módulo `saude`

**Files:**
- *api*
  - `routes/{consultas,prontuarios}.ts` → `modulos/saude/rotas/`.
  - De `prontuarios.ts`, `paraContrato`, `consultar` e `lista` vão para `consultas/prontuarios.ts`, e `validarVinculos` para `regras/prontuarios.ts`.
  - `index.ts` com `saudeRotas`.
  - `test/prontuarios.test.ts` → `test/saude/`.
- *shared:* `consultas.ts`, `prontuarios.ts`, `agenda-prontuario.test.ts` → `shared/src/saude/`.
- *web*
  - `agenda/{agenda-view,calendario}.tsx` → `modulos/saude/componentes/agenda/`. `agenda-view.tsx` (609) é quebrado em:
    - `agenda-view.tsx` (`AgendaView`, `Modo`, `Props`);
    - `linha-consulta.tsx`;
    - `semana.tsx`;
    - `consulta-modal.tsx` (`ConsultaModal`, `DURACOES`, `duracao`);
    - `util.ts` (`nomeAlvo`, `tituloDia`, `comMudanca`, `NovaConsulta`, `Veterinario`).
  - `prontuarios/{prontuarios-view,prontuario-modal}.tsx` → `componentes/prontuarios/`. `prontuario-modal.tsx` é quebrado em `pares.tsx` e `prontuario-modal.tsx`.
  - `getConsultas` e `getProntuarios` → `dados.ts`.
  - Atualizar as páginas `agenda` e `prontuarios`.

- [ ] **Step 1:** shared, mover e gate.
- [ ] **Step 2:** api, mover, dividir, `app.ts` e gate.
- [ ] **Step 3:** web, mover, dividir e páginas.
- [ ] **Step 4:** Gate da raiz.
- [ ] **Step 5:** Commit `saúde: módulo próprio na api, no web e no shared`.

---

### Task 6: módulo `conta`

**Files:**
- *api*
  - `routes/{perfil,usuarios}.ts` → `modulos/conta/rotas/`.
  - `usuarios/criar-usuario.ts` → `modulos/conta/regras/criar-usuario.ts`.
  - `index.ts` com `contaRotas`.
  - `test/usuarios.test.ts` → `test/conta/`.
  - `db/seed.ts` passa a importar `criar-usuario` por `../modulos/conta`, a porta de entrada.
- *shared:* `auth.ts` e `usuarios.ts` → `shared/src/conta/`.
- *web*
  - `perfil/perfil-form.tsx`, `configuracoes/{conta-form,config-nav}.tsx` e `configuracoes/usuarios/usuarios-lista.tsx` → `modulos/conta/componentes/`.
  - `usuarios-lista.tsx` (424) é quebrado em `usuarios/usuarios-lista.tsx`, `usuarios/adicionar-modal.tsx`, `usuarios/vincular-modal.tsx`, `usuarios/editar-modal.tsx` e `usuarios/remover-modal.tsx`.
  - `getUsuarios` → `dados.ts`. As funções de sessão e organização ficam no `dal.ts`.
  - Atualizar `perfil/page.tsx`, `configuracoes/page.tsx`, `configuracoes/layout.tsx` e `configuracoes/usuarios/page.tsx`.

- [ ] **Step 1:** shared, mover e gate.
- [ ] **Step 2:** api, mover, `app.ts` e gate.
- [ ] **Step 3:** web, mover, dividir e páginas.
- [ ] **Step 4:** Gate da raiz.
- [ ] **Step 5:** Commit `conta: módulo próprio na api, no web e no shared`.

---

### Task 7: módulo `avisos`

**Files:**
- *api*
  - `routes/{notificacoes,novidades}.ts` → `modulos/avisos/rotas/`.
  - `notificacoes/notificar.ts` → `modulos/avisos/regras/notificar.ts`.
  - `index.ts` exporta `avisosRotas`, `notificar` e `administradores`.
  - `notas/rotas.ts` passa a importar de `../avisos`.
  - `test/novidades.test.ts` → `test/avisos/`.
- *shared:* `notificacoes.ts` e `novidades.ts` → `shared/src/avisos/`.
- *web*
  - `components/app/ao-vivo.tsx` → `modulos/avisos/componentes/ao-vivo.tsx`.
  - `lib/ao-vivo.ts` e `lib/ao-vivo.test.ts` → `modulos/avisos/ao-vivo.ts` e `.test.ts`.
  - `getNotificacoes` e `getNovidades` → `dados.ts`.
  - `(app)/layout.tsx` e `components/app/header.tsx` passam a importar de `@/modulos/avisos`.

**Interfaces:** `notas` → `avisos` passa a ser um dos sentidos permitidos; o teste de ciclo confirma.

- [ ] **Step 1:** shared, mover e gate.
- [ ] **Step 2:** api, mover, `app.ts`, import em `notas` e gate.
- [ ] **Step 3:** web, mover e imports.
- [ ] **Step 4:** Gate da raiz.
- [ ] **Step 5:** Commit `avisos: módulo próprio na api, no web e no shared`.

---

### Task 8: módulo `painel`

**Files:**
- *api*
  - `routes/{inicio,relatorios}.ts` → `modulos/painel/rotas/`.
  - O `hojeISO` local de `relatorios.ts` é substituído pelo de `base/datas.ts`, que tem o mesmo resultado (SP, `en-CA`).
  - `index.ts` com `painelRotas`.
  - A pasta `routes/` deixa de existir.
- *shared:* `inicio.ts` e `relatorios.ts` → `shared/src/painel/`.
- *web*
  - O conteúdo de `dashboard/page.tsx` (exceto a busca de dados) → `modulos/painel/componentes/inicio.tsx`, que usa `GalpoesHoje` de `@/modulos/aviario`.
  - `relatorios/relatorios-view.tsx` → `modulos/painel/componentes/`.
  - `getAvisos` e `getRelatorio` → `dados.ts`.
  - `app/(app)/kit/kit-view.tsx` → `components/ui/catalogo.tsx`.
- Checagem final: `rg -l "^export (const|async function) get" apps/web/src/lib/auth/dal.ts` mostra só as funções de sessão e organização. `apps/api/src/` não tem mais `routes/`, `lotes/`, `ia/`, `membros/`, `notificacoes/` ou `usuarios/`.

- [ ] **Step 1:** shared, mover e gate.
- [ ] **Step 2:** api, mover, `app.ts` e gate.
- [ ] **Step 3:** web, mover, `kit` e páginas.
- [ ] **Step 4:** Gate da raiz.
- [ ] **Step 5:** Commit `painel: módulo próprio na api, no web e no shared`.

---

### Task 9: `CLAUDE.md` e conferência final

**Files:** Modify `CLAUDE.md` (raiz).

- [ ] **Step 1: Seção nova "Estrutura por módulo"** no `CLAUDE.md`, logo depois de "Regras". No máximo 15 linhas, cobrindo:
  - a lista dos 7 módulos;
  - o esqueleto da api (`rotas`, `regras/`, `consultas`, `index.ts`; tabelas em `db/tabelas/<modulo>.ts`; `base/`);
  - o esqueleto do web (`componentes/`, `dados.ts` server-only, `index.ts`; `app/` com páginas finas);
  - o esqueleto do shared;
  - as regras: porta de entrada, nada de ciclo, ~300 linhas, código novo no módulo;
  - "o `test/estrutura.test.ts` e o `src/modulos/estrutura.test.ts` barram import errado".

  Atualizar os dois trechos que citam caminhos antigos:
  - a linha "Rota da api: `apps/api/test/`" passa a ser "`apps/api/test/<modulo>/`";
  - a linha da sessão em `src/lib/auth/dal.ts` continua igual.
- [ ] **Step 2: Gate completo.**
  - Na raiz: `npm run typecheck && npm run lint && npm test && npm run build`.
  - Em `apps/api`: `npx drizzle-kit generate` → "No schema changes".
- [ ] **Step 3: Conferência no navegador.**
  - Subir `vocare-dev` pelo preview.
  - Depois que o Arthur fizer login, abrir `/dashboard`, `/notas`, `/animais`, uma ficha de animal, `/lotes`, a ficha de um lote, `/agenda`, `/prontuarios`, `/relatorios`, `/configuracoes/usuarios`, `/configuracoes/galpoes` e `/kit`.
  - Nenhuma pode ter erro no console nem 500 no log.
- [ ] **Step 4: Commit** `docs: estrutura por módulo no CLAUDE.md`.
