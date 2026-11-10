# Aviário de matrizes — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lotes de aves alojados em galpões, apontamento diário por galpão (pelo colar, via ocorrência, ou manual), pesagem e vacinação do lote, e indicadores do lote nas telas.

**Architecture:** Tabelas genéricas `instalacao`/`lote`/`alojamento` + tabelas do aviário em `apps/api/src/db/lotes.ts`; contratos e indicadores (funções puras) em `packages/shared`; rotas novas em `apps/api/src/routes/lotes.ts`; três operações novas encaixadas no fluxo de ocorrência existente (`analisar()` → conferência → `/confirmar`); telas no web com o kit `@/components/ui`.

**Tech Stack:** Hono, Drizzle (Postgres/Neon; PGlite nos testes), Zod 4, Next.js 16, Vitest. Nada novo.

**Spec:** `docs/superpowers/specs/2026-11-10-aviario-matrizes-design.md`

## Global Constraints

- Node 24 (`export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"` antes de qualquer `npm`/`npx`).
- Web nunca importa de `apps/api` e vice-versa; contrato atravessa por `packages/shared`.
- Não editar `apps/api/src/db/schema.ts` (gerado). Tabelas novas só em `apps/api/src/db/lotes.ts`.
- **Não rodar `npm run db:migrate`** (dev/hom/prod no mesmo banco). Só `npm run db:generate` (offline). A migration roda depois, com autorização do Arthur.
- Toda rota: `membroAtual(c.req.raw.headers, orgId)` primeiro; sem membro → 403; recurso de outra organização → 404.
- Escrita em instalação/lote/alojamento e lançamento manual, pesagem e vacinação: só `owner`/`admin` (mesma lista `PODE_SALVAR` de `routes/ocorrencias.ts`). Leitura: qualquer membro.
- Falha de aplicação no `/confirmar` segue o padrão atual da rota: **400** com a mensagem, nada gravado (a spec dizia 422; o `/confirmar` já devolve 400 para toda falha de aplicação e fica assim). Nas rotas novas de lote: 400 (Zod), 404, 409 (sobreposição), 422 (regra de negócio).
- "Data futura" = `data > hojeISO()` (fuso `America/Sao_Paulo`, mesmo helper do `/confirmar`).
- Mensagens de erro em português, dizendo o que fazer. Identificadores em português, como o resto do código.
- Telas com o kit `@/components/ui` (ver `/kit`). Tela não tem teste; a regra por trás tem.
- Cada task termina com `npm test` verde e commit direto na `main`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Dia da transferência**: lote A sai do Galpão 1 e lote B entra no mesmo dia → o apontamento daquele dia vai para o lote B (alojamento novo começa em `data`; o antigo termina em `data − 1`). Teste na Task 5.
2. **Galpão que a IA não reconhece** ("galpão sete" quando só existe "Galpão 7B") → `instalacaoId: null`, operação não marcável (`temAlvo` false), confiança ≤ 60. Teste na Task 7.
3. **Duas operações do mesmo galpão/dia na mesma nota** → as duas somam dentro da transação. Teste na Task 8.
4. **Edição manual depois de voz**: `PUT` substitui; um áudio confirmado depois soma em cima do valor editado. Teste na Task 6.
5. **Lote sem aves de um sexo ou dia sem ração** → indicadores `null`, nunca `NaN`/`Infinity`. Teste na Task 2.

---

### Task 1: Contratos de lotes em `shared`

**Files:**
- Create: `packages/shared/src/lotes.ts`
- Modify: `packages/shared/src/index.ts` (adicionar `export * from "./lotes";`)
- Test: `packages/shared/src/lotes.test.ts`

**Interfaces:**
- Produces (todos exportados de `@vocare/shared`):
  - `TIPOS_INSTALACAO = ["galpao", "pasto", "baia", "incubadora"] as const`, `ROTULO_TIPO_INSTALACAO`
  - `FASES_LOTE = ["recria", "producao"] as const`, `ROTULO_FASE_LOTE`; `SITUACOES_LOTE = ["ativo", "encerrado"] as const`
  - `CAMPOS_APONTAMENTO = ["mortasFemeas","mortasMachos","eliminadasFemeas","eliminadasMachos","ovosTotal","ovosIncubaveis","ovosTrincados","ovosSujos","ovosDuasGemas","ovosDescarte","racaoKg","aguaL"] as const`, `type CampoApontamento`, `ROTULO_CAMPO_APONTAMENTO: Record<CampoApontamento, string>`
  - `CLASSES_OVO = ["ovosIncubaveis","ovosTrincados","ovosSujos","ovosDuasGemas","ovosDescarte"] as const`
  - `LIMITE_MORTALIDADE_DIA = 0.001`
  - `instalacaoSchema` / `type Instalacao` = `{ id, nome, tipo, capacidade: number|null, areaM2: number|null, ativa: boolean, loteAtual: { id, codigo } | null }`
  - `criarInstalacaoSchema` (nome 1–60, tipo, capacidade int ≥ 1 nullish, areaM2 > 0 nullish), `editarInstalacaoSchema = criarInstalacaoSchema.partial().extend({ ativa: z.boolean().optional() })`
  - `valoresApontamentoSchema`: objeto com cada `CampoApontamento` opcional e nullable (inteiros ≥ 0; `racaoKg`/`aguaL` número ≥ 0) + `observacoes` (≤ 500) nullable opcional; `.superRefine`: se `ovosTotal` informado, Σ `CLASSES_OVO` informadas ≤ `ovosTotal` → mensagem `"A soma das classes de ovo passa do total."`
  - `criarLoteSchema` = `{ codigo (1–30), especie (especieSchema, default "ave"), linhagem nullish, dataAlojamento, idadeAlojamentoDias int ≥ 0 default 0, fase default "recria", galpoes: [{ instalacaoId, femeas int ≥ 0, machos int ≥ 0 }] min 1 }`; `femeasIniciais`/`machosIniciais` são a soma dos galpões (calculadas pela api, não vêm no corpo)
  - `transferirLoteSchema = { data, de: instalacaoId, para: instalacaoId, femeas, machos }`; `faseLoteSchema = { fase }`; `encerrarLoteSchema = { data }`
  - `pesagemLoteInputSchema = { data, sexo (sexoSchema), pesoMedioG > 0 ≤ 10000, uniformidadePct 0–100 nullish, amostra int ≥ 1 nullish, instalacaoId nullish }`
  - `vacinacaoLoteInputSchema = { data, vacina (1–80), via nullish, proximaData nullish }`
  - Todas as datas usam o `dataIso` já usado em `animais.ts`.
  - Os schemas de resposta (`loteResumoSchema`, `fichaLoteSchema`, `galpaoHojeSchema`) ficam para a Task 2, porque usam os tipos de indicador de lá.

- [ ] **Step 1: Write the failing tests** em `lotes.test.ts`:
  - `valoresApontamentoSchema` aceita `{}` e `{ mortasFemeas: 3, racaoKg: 512.5 }`; recusa `{ mortasFemeas: -1 }` e `{ mortasMachos: 1.5 }`.
  - `{ ovosTotal: 100, ovosIncubaveis: 90, ovosTrincados: 15 }` falha com `"A soma das classes de ovo passa do total."`; `{ ovosIncubaveis: 90, ovosTrincados: 15 }` (sem total) passa.
  - `criarLoteSchema` recusa `galpoes: []`; aplica defaults `especie: "ave"`, `idadeAlojamentoDias: 0`, `fase: "recria"`.
  - `pesagemLoteInputSchema` recusa `uniformidadePct: 101`.
- [ ] **Step 2:** `npx vitest run packages/shared/src/lotes.test.ts` (na raiz do pacote) → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `lotes.ts` com os nomes acima; `especieSchema` vem de `./animais` (`"ave"` já está em `ESPECIES`).
- [ ] **Step 4:** `npm test -w packages/shared` → PASS.
- [ ] **Step 5:** Commit `shared: contratos de lotes e galpões`.

### Task 2: Indicadores do lote (funções puras)

**Files:**
- Create: `packages/shared/src/indicadores-lote.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/indicadores-lote.test.ts`

**Interfaces:**
- Consumes: `CampoApontamento`, `LIMITE_MORTALIDADE_DIA` (Task 1).
- Produces:
  - `type ApontamentoDia = { data: string; instalacaoId: string } & Partial<Record<CampoApontamento, number | null>>`
  - `semanaDeVida(dataAlojamento: string, idadeAlojamentoDias: number, data: string): number` = ⌊(dias entre datas + idade) / 7⌋ + 1
  - `avesVivas(iniciais: { femeas: number; machos: number }, aps: ApontamentoDia[], ate: string): { femeas: number; machos: number }` (inclui o dia `ate`)
  - `razao(parte: number | null | undefined, todo: number | null | undefined): number | null` — `null` se algum lado é null/undefined ou `todo <= 0`
  - `type IndicadoresDia = { posturaPct; incubaveisPct; racaoGAveDia; aguaRacao; mortalidadeDiaPct }` (todos `number | null`, percentuais em 0–100 com 1 casa decimal)
  - `indicadoresDoDia(ap: ApontamentoDia, vivasInicioDia: { femeas; machos }): IndicadoresDia` — postura sobre fêmeas vivas; ração g/ave sobre fêmeas + machos; mortalidade do dia sobre vivas no início do dia
  - `mortalidadeAlta(ap: ApontamentoDia, vivasInicioDia): boolean` — (mortas + eliminadas, os dois sexos) > `LIMITE_MORTALIDADE_DIA` × vivas
  - `type IndicadoresLote = { vivas; mortalidadeAcumuladaPct; posturaSemanaPct; incubaveisPorFemea; racaoGAveDiaSemana }` (`incubaveisPorFemea` = Σ incubáveis ÷ `femeasIniciais`, 2 casas)
  - `indicadoresDoLote(lote: { dataAlojamento; idadeAlojamentoDias; femeasIniciais; machosIniciais }, aps: ApontamentoDia[], hoje: string): IndicadoresLote` ("semana" = a semana de vida que contém `hoje`)
  - `type SemanaLote = { semana; inicio; fim; mortas; eliminadas; mortalidadePct; posturaPct; incubaveisPct; racaoGAveDia; pesoFemeaG; pesoMachoG; uniformidadeFemeaPct; uniformidadeMachoPct }` e `consolidarSemanas(lote, aps, pesagens: { data; sexo; pesoMedioG; uniformidadePct: number|null }[]): SemanaLote[]` (pesagem da semana = a última da semana para cada sexo)
  - Apontamentos de vários galpões no mesmo dia somam antes do cálculo do lote.
  - Schemas de resposta, em `lotes.ts` (Zod espelhando os tipos acima):
    - `diaGalpaoSchema` / `DiaGalpao` = `{ data, instalacaoId, instalacaoNome, ocorrenciaId: string|null, valores: ValoresApontamento (Task 1), indicadores: IndicadoresDia }`
    - `loteResumoSchema` / `LoteResumo` = `{ id, codigo, linhagem, fase, situacao, dataAlojamento, semana, galpoes: {id,nome}[], vivas: {femeas,machos}, posturaOntemPct: number|null, mortalidadeSemanaPct: number|null, semApontamentoHoje: boolean, mortalidadeAltaHoje: boolean }`
    - `fichaLoteSchema` / `FichaLote` = `{ lote: LoteResumo & { idadeAlojamentoDias, femeasIniciais, machosIniciais, dataEncerramento }, alojamentos: {id, instalacaoId, instalacaoNome, inicio, fim, femeas, machos}[], indicadores: IndicadoresLote, diario: DiaGalpao[], semanal: SemanaLote[], pesagens: {id, data, sexo, pesoMedioG, uniformidadePct, amostra, ocorrenciaId}[], vacinacoes: {id, data, vacina, via, proximaData, ocorrenciaId}[] }`
    - `galpaoHojeSchema` / `GalpaoHoje` = `{ instalacaoId, nome, loteId, loteCodigo, apontado: boolean }`

- [ ] **Step 1: Write the failing tests:**
  - `semanaDeVida("2026-01-01", 0, "2026-01-01") === 1`, `("2026-01-01", 0, "2026-01-08") === 2`, `("2026-01-01", 140, "2026-01-01") === 21`.
  - `avesVivas({femeas:1000, machos:100}, [{data:"2026-01-02", instalacaoId:"g", mortasFemeas:3, eliminadasFemeas:2, mortasMachos:1}], "2026-01-02")` → `{femeas:995, machos:99}`; com `ate: "2026-01-01"` → `{femeas:1000, machos:100}`.
  - `indicadoresDoDia({…, ovosTotal: 800, ovosIncubaveis: 760, racaoKg: 165}, {femeas:1000, machos:100})` → `posturaPct: 80`, `incubaveisPct: 95`, `racaoGAveDia: 150`.
  - **Review Focus 5:** `indicadoresDoDia({…, ovosTotal: 10}, {femeas:0, machos:100}).posturaPct === null`; `aguaRacao` com `racaoKg: 0` → `null`; nenhum valor do resultado é `NaN` nem `Infinity` (`Object.values(r).every(v => v === null || Number.isFinite(v))`).
  - `mortalidadeAlta({…, mortasFemeas: 2}, {femeas:1000, machos:0})` → `true`; `{…, mortasFemeas: 1}` → `false`.
  - `consolidarSemanas`: 8 dias de apontamento a partir do alojamento → 2 semanas; a semana 1 soma os 7 primeiros dias.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar com os nomes acima; diferença de dias via `Date.UTC` das partes `AAAA-MM-DD` (sem fuso).
- [ ] **Step 4:** `npm test -w packages/shared` → PASS.
- [ ] **Step 5:** Commit `shared: indicadores do lote`.

### Task 3: Tabelas e migration

**Files:**
- Create: `apps/api/src/db/lotes.ts`, migration gerada em `apps/api/drizzle/0011_*.sql` (+ `meta/`)
- Create: `apps/api/src/datas.ts` (mover `hojeISO()` de `routes/ocorrencias.ts` para cá, exportado; `ocorrencias.ts` passa a importar)
- Modify: `apps/api/src/db/index.ts` (spread `...lotes` no schema), `apps/api/drizzle.config.ts` (adicionar `"./src/db/lotes.ts"`), `apps/api/test/setup.ts` (adicionar `...(await import("../src/db/lotes"))`)
- Test: `apps/api/test/lotes.test.ts` (criado aqui com o primeiro teste)

**Interfaces:**
- Produces (exportados de `db/lotes.ts`): `instalacao`, `lote`, `alojamento`, `apontamentoAviario`, `pesagemLote`, `vacinacaoLote` — colunas, unicidades e índices exatamente como a tabela "Modelo de dados" da spec. Padrão de `db/historico.ts` (`id` uuid via `$defaultFn`, `organizationId` cascade, `criadoPorId` set null, `createdAt`). `ocorrenciaId` (set null) em `apontamentoAviario`, `pesagemLote`, `vacinacaoLote`. FKs `loteId`/`instalacaoId` com `onDelete: "cascade"`. `racaoKg`/`aguaL`/`pesoMedioG`/`uniformidadePct`/`areaM2` em `numeric`. Únicos: `instalacao (organization_id, nome)`, `lote (organization_id, codigo)`, `apontamento_aviario (instalacao_id, data)`.

- [ ] **Step 1: Write the failing test** em `lotes.test.ts`: `it("migration cria as tabelas do aviário")` insere direto pelo `db` uma `instalacao`, um `lote`, um `alojamento` e um `apontamentoAviario` para uma fazenda de `criarFazenda("Granja Teste")` e lê de volta; inserir um segundo `apontamentoAviario` com o mesmo `(instalacaoId, data)` rejeita.
- [ ] **Step 2:** `npm test -w apps/api -- lotes` → FAIL (import não existe).
- [ ] **Step 3:** Escrever `db/lotes.ts`, ligar nos três arquivos, `npm run db:generate` (na raiz). **Não** rodar `db:migrate`.
- [ ] **Step 4:** `npm test -w apps/api` → PASS (PGlite aplica a migration nova).
- [ ] **Step 5:** Commit `api: tabelas de lotes, galpões e apontamento do aviário`.

### Task 4: Rotas de instalações

**Files:**
- Create: `apps/api/src/routes/lotes.ts` (exporta `lotesRoutes`, um `Hono` como os outros)
- Modify: `apps/api/src/app.ts` (`app.route("/api/org", lotesRoutes);`)
- Test: `apps/api/test/lotes.test.ts`

**Interfaces:**
- Consumes: `criarInstalacaoSchema`, `editarInstalacaoSchema`, `instalacaoSchema` (Task 1); tabelas (Task 3).
- Produces: `GET /:orgId/instalacoes` → `Instalacao[]` ordenado por nome, `loteAtual` = alojamento com `fim IS NULL`; `POST /:orgId/instalacoes` → 201 + `Instalacao`; `PATCH /:orgId/instalacoes/:id` → `Instalacao`. Nome repetido → 409 `"Já existe uma instalação com esse nome."`.

- [ ] **Step 1: Write the failing tests:** dono cria "Galpão 1" (201) e lista; admin edita capacidade; membro recebe 403 em POST e PATCH mas 200 no GET; outra fazenda (`criarFazenda("Outra Granja")`) recebe 404 no PATCH do galpão alheio e não o vê no GET; nome repetido → 409.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar as três rotas.
- [ ] **Step 4:** `npm test -w apps/api` → PASS.
- [ ] **Step 5:** Commit `api: cadastro de galpões`.

### Task 5: Rotas de lotes e alojamento

**Files:**
- Modify: `apps/api/src/routes/lotes.ts`
- Create: `apps/api/src/lotes/alojamento.ts`
- Test: `apps/api/test/lotes.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `loteNaData(tx: Tx | typeof db, orgId: string, instalacaoId: string, data: string): Promise<{ loteId: string; situacao: "ativo" | "encerrado"; dataEncerramento: string | null } | null>` em `lotes/alojamento.ts` — alojamento com `inicio <= data AND (fim IS NULL OR fim >= data)`.
  - `sobrepoe(tx, instalacaoId, inicio, fim: string | null, ignorarId?: string): Promise<boolean>` — intervalos `[inicio, fim ?? ∞]` se cruzam.
  - `POST /:orgId/lotes` (cria lote com `femeasIniciais`/`machosIniciais` = Σ galpões e um alojamento por galpão começando em `dataAlojamento`) → 201 + `{ id }`; galpão ocupado → 409 `"O Galpão X já tem lote alojado nesse período."`; código repetido → 409.
  - `GET /:orgId/lotes?situacao=ativo|encerrado` → `LoteResumo[]` (usa `indicadoresDoDia`/`mortalidadeAlta` da Task 2 com `hojeISO()`).
  - `POST /:orgId/lotes/:id/transferir` (`transferirLoteSchema`): fecha o alojamento aberto em `de` com `fim = data − 1` e abre um em `para` com `inicio = data`; destino ocupado → 409.
  - `POST /:orgId/lotes/:id/fase`, `POST /:orgId/lotes/:id/encerrar` (situação `encerrado`, `dataEncerramento = data`, fecha alojamentos abertos com `fim = data`).

- [ ] **Step 1: Write the failing tests:**
  - Dono aloja `L-01` em "Galpão 1" (1000 F / 100 M) → `GET lotes` traz `vivas {femeas:1000, machos:100}` e `semApontamentoHoje: true`.
  - Alojar `L-02` no "Galpão 1" com data dentro do período de `L-01` → 409.
  - Membro → 403 em criar/transferir/fase/encerrar; outra fazenda → 404 em `transferir` do lote alheio.
  - **Review Focus 1:** `L-01` transfere do Galpão 1 para o Galpão 2 em `2026-03-10`; `L-02` aloja no Galpão 1 em `2026-03-10` (201); `loteNaData(db, org, galpao1, "2026-03-09")` → `L-01`; `(…, galpao1, "2026-03-10")` → `L-02`; `(…, galpao2, "2026-03-10")` → `L-01`.
  - Encerrar `L-01` → aparece em `?situacao=encerrado` e não em `ativo`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test -w apps/api` → PASS.
- [ ] **Step 5:** Commit `api: lotes, alojamento e transferência`.

### Task 6: Apontamento manual, pesagem, vacinação e ficha do lote

**Files:**
- Create: `apps/api/src/lotes/apontamento.ts`
- Modify: `apps/api/src/routes/lotes.ts`
- Test: `apps/api/test/lotes.test.ts`

**Interfaces:**
- Consumes: `loteNaData` (Task 5), `valoresApontamentoSchema`, `pesagemLoteInputSchema`, `vacinacaoLoteInputSchema`, `fichaLoteSchema`, indicadores (Tasks 1–2).
- Produces (em `lotes/apontamento.ts`, usados também pela Task 8):
  - `type ValoresApontamento = z.infer<typeof valoresApontamentoSchema>`
  - `validarApontamento(tx, orgId, instalacaoId, data, valores, modo: "somar" | "substituir"): Promise<{ loteId: string } | string>` — devolve a mensagem de erro (texto) quando: data futura (`"Data no futuro."`), galpão sem lote na data (`"Galpão X não tem lote alojado em DD/MM. Aloje o lote ou corrija o galpão."`), lote encerrado antes da data (`"O lote L-01 foi encerrado em DD/MM."`), mortas + eliminadas do dia (já somadas se `modo = "somar"`) > aves vivas no início do dia (`"Mais aves mortas e eliminadas do que aves vivas no Galpão X."`).
  - `somarApontamento(tx, origem: { organizationId; criadoPorId; ocorrenciaId: string | null }, instalacaoId, loteId, data, valores): Promise<void>` — `INSERT … ON CONFLICT (instalacao_id, data) DO UPDATE SET campo = CASE WHEN excluded.campo IS NULL THEN apontamento_aviario.campo ELSE coalesce(apontamento_aviario.campo, 0) + excluded.campo END` para cada `CampoApontamento`; `observacoes` concatena com `"\n"`.
  - `substituirApontamento(tx, origem, instalacaoId, loteId, data, valores): Promise<void>` — upsert que grava os valores como vieram (null limpa).
  - Rotas: `PUT /:orgId/lotes/:id/apontamentos/:instalacaoId/:data` (substitui; 422 com a mensagem do `validarApontamento`; 422 se o lote da data não é `:id`); `POST /:orgId/lotes/:id/pesagens`; `POST /:orgId/lotes/:id/vacinacoes` (data depois do encerramento → 422); `GET /:orgId/lotes/:id` → `FichaLote` (`diario` por dia × galpão, com `ocorrenciaId` para a tela marcar a origem; `semanal` de `consolidarSemanas`; `indicadores` de `indicadoresDoLote`).

- [ ] **Step 1: Write the failing tests:**
  - Dono faz `PUT` de 3 dias no Galpão 1 do `L-01` (1000 F) com `ovosTotal`/`ovosIncubaveis`/`racaoKg`/`mortasFemeas`; `GET lotes/:id` traz `indicadores.vivas.femeas` = 1000 − Σ mortas e `diario` com 3 linhas; um segundo `PUT` no mesmo dia **substitui** (não soma).
  - **Review Focus 4:** `PUT` grava `mortasFemeas: 5`; depois `somarApontamento` com `mortasFemeas: 2` (chamado direto pelo `db`) → linha fica com 7.
  - Data futura → 422; galpão sem lote → 422 com a mensagem acima; lote encerrado em `D` e `PUT`/`vacinacoes` em `D + 1` → 422; `mortasFemeas: 1001` com 1000 vivas → 422.
  - Membro → 403 no `PUT`, `pesagens`, `vacinacoes` e 200 no `GET`; outra fazenda → 404 no `GET` do lote alheio.
  - Pesagem de fêmeas (`pesoMedioG: 2850`, `uniformidadePct: 82`) aparece em `semanal[n].pesoFemeaG`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test -w apps/api` → PASS.
- [ ] **Step 5:** Commit `api: apontamento manual, pesagem, vacinação e ficha do lote`.

### Task 7: Operações da IA para o aviário

**Files:**
- Modify: `packages/shared/src/ocorrencias.ts`, `apps/api/src/ia/analisar.ts`, `apps/api/src/routes/ocorrencias.ts` (POST que chama `analisar`)
- Test: `packages/shared/src/ocorrencias.test.ts`, `apps/api/test/analisar-aviario.test.ts`

**Interfaces:**
- Consumes: `valoresApontamentoSchema`, `CAMPOS_APONTAMENTO` (Task 1); `semanaDeVida`, `avesVivas` (Task 2); `loteNaData` (Task 5).
- Produces:
  - Em `operacaoSchema`, três membros novos (todos com `animalId: null` vindo da base):
    - `apontar_galpao`: `instalacaoId: z.string().nullable()`, `data: dataIso.nullable()` (null = hoje) + `valoresApontamentoSchema.shape` (todos nullable)
    - `pesar_lote`: `loteId: z.string().nullable()`, `data: dataIso.nullable()`, `sexo: sexoSchema`, `pesoMedioG`, `uniformidadePct`, `amostra` (como `pesagemLoteInputSchema`, nullable onde lá é nullish)
    - `vacinar_lote`: `loteId: z.string().nullable()`, `vacina`, `via: textoOpcional`, `data: dataIso.nullable()`, `proximaData: dataIso.nullable()`
  - `DESTINO_OPERACAO`: `apontar_galpao: { acao: "Registrar apontamento do galpão", feito: "Apontamento registrado", onde: "Lotes › Diário" }`, `pesar_lote: { acao: "Registrar pesagem do lote", feito: "Pesagem do lote registrada", onde: "Lotes › Pesagens" }`, `vacinar_lote: { acao: "Registrar vacina do lote", feito: "Vacina do lote registrada", onde: "Lotes › Vacinas" }`.
  - `CAMPOS_CORRIGIVEIS`: `apontar_galpao: ["instalacaoId", "data", ...CAMPOS_APONTAMENTO, "observacoes"]`, `pesar_lote: ["loteId", "data", "sexo", "pesoMedioG", "uniformidadePct", "amostra"]`, `vacinar_lote: ["loteId", "vacina", "via", "data", "proximaData"]`.
  - `TIPOS_AVIARIO: readonly TipoOperacao[] = ["apontar_galpao", "pesar_lote", "vacinar_lote"]`.
  - `temAlvo(op)`: `apontar_galpao` → `!!op.instalacaoId`; `pesar_lote`/`vacinar_lote` → `!!op.loteId`; o resto como hoje.
  - Em `analisar.ts`: `export type GalpaoParaIa = { instalacaoId: string; nome: string; loteId: string; loteCodigo: string; semana: number; femeas: number; machos: number }`; `analisar(transcricao, hoje, animais, grupos = [], galpoes: GalpaoParaIa[] = [])`; `export function instrucoes(...)` e `export function normalizar(bruta, idsAnimais, idsGrupos, galpoes: GalpaoParaIa[] = [])` passam a ser exportadas. Com `galpoes.length === 0`, os três tipos ficam fora do `enum` da ferramenta e do texto das instruções. Em `normalizar`, `instalacaoId`/`loteId` só valem se estiverem em `galpoes`; sem alvo, confiança ≤ 60 (como hoje).
  - Em `routes/ocorrencias.ts`: `galpoesDaOrg(orgId, hoje): Promise<GalpaoParaIa[]>` (alojamentos abertos hoje + `semanaDeVida` + `avesVivas`) passado como 5º argumento.

- [ ] **Step 1: Write the failing tests:**
  - `ocorrencias.test.ts` (shared): `operacaoSchema` aceita um `apontar_galpao` com `instalacaoId: "g1"`, `mortasFemeas: 12`, `ovosTotal: 8400`, `ovosTrincados: 310`; `temAlvo` dele é `true` e com `instalacaoId: null` é `false`; `CAMPOS_CORRIGIVEIS.pesar_lote` contém `"loteId"`.
  - `analisar-aviario.test.ts` (api): `instrucoes("2026-03-10", [], [], [galpão3])` contém `"Galpão 3"` e `"L-07"`; `instrucoes(..., [])` não contém `"apontar_galpao"`; `normalizar({ tipo: "apontar_galpao", instalacaoId: "g3", mortasFemeas: 12, confianca: 95, … }, ∅, ∅, [galpão3])` → operação válida com `instalacaoId: "g3"`.
  - **Review Focus 2:** `normalizar` com `instalacaoId: "inexistente"` → `instalacaoId: null`, `confianca <= 60`, `temAlvo(op) === false`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar; propriedades novas no `input_schema` da ferramenta com descrição curta por campo ("apontar_galpao: aves fêmeas mortas no dia", …); o texto das instruções lista os galpões no formato `- Galpão 3 (id g3): lote L-07, semana 31, 9.850 fêmeas e 1.020 machos`.
- [ ] **Step 4:** `npm test` (raiz) → PASS. Typecheck do web vai falhar nos `switch (op.tipo)` exaustivos de `ocorrencias-view.tsx` — é esperado e se resolve na Task 12; se o CI do commit exigir typecheck verde, juntar o commit desta task com o da Task 12.
- [ ] **Step 5:** Commit `ocorrências: operações do aviário na análise da IA`.

### Task 8: Confirmar as operações do aviário

**Files:**
- Create: `apps/api/src/lotes/aplicar.ts`
- Modify: `apps/api/src/routes/ocorrencias.ts` (`aplicar()`: antes de `alvos()`, `if (TIPOS_AVIARIO.includes(op.tipo)) return aplicarAviario(tx, op, origem, hoje)`)
- Test: `apps/api/test/ocorrencias-aviario.test.ts`

**Interfaces:**
- Consumes: `validarApontamento`, `somarApontamento` (Task 6), `loteNaData` (Task 5), operações (Task 7).
- Produces: `aplicarAviario(tx, op, origem: { organizationId; ocorrenciaId; criadoPorId }, hoje: string): Promise<string | null>` — `apontar_galpao` → `validarApontamento(..., "somar")` + `somarApontamento`; `pesar_lote`/`vacinar_lote` → confere que o lote é da organização e está ativo na data, insere. `data: null` = `hoje`. Erro volta como texto, e o `/confirmar` já transforma em 400 com rollback.

- [ ] **Step 1: Write the failing tests** (ocorrência inserida direto no banco, como `ocorrenciaDoMembro` em `test/ocorrencias.test.ts`; `L-07` alojado no Galpão 3):
  - Confirmar `apontar_galpao` (`mortasFemeas: 12`, `ovosTotal: 8400`) cria a linha do dia com `ocorrenciaId`; uma segunda ocorrência com `mortasFemeas: 3` soma → 15.
  - **Review Focus 3:** uma ocorrência com dois `apontar_galpao` do Galpão 3 no mesmo dia (`ovosTotal: 4000` e `ovosTotal: 4400`) → linha com `ovosTotal: 8400`.
  - Galpão sem lote na data → 400 com `"Galpão 4 não tem lote alojado"` no texto; ocorrência continua `pendente`; nenhuma linha gravada (nem das outras operações da mesma nota).
  - `pesar_lote` e `vacinar_lote` gravam em `pesagemLote`/`vacinacaoLote` com o `loteId` certo; `loteId` de outra organização → 400 `"Lote não encontrado nesta organização."`.
  - Membro → 403 (regra existente, só conferir que vale para as novas).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `ocorrências: confirmar apontamento, pesagem e vacina do lote`.

### Task 9: Web — Galpões em Configurações e menu

**Files:**
- Modify: `apps/web/src/lib/auth/dal.ts` (`getInstalacoes(orgId): Promise<Instalacao[]>`, `getLotes(orgId, situacao: "ativo" | "encerrado"): Promise<LoteResumo[]>`, `getLote(orgId, id): Promise<FichaLote | null>`, `getGalpoesHoje(orgId): Promise<GalpaoHoje[]>` — padrão de `getGrupos`, `cache` + `safeParse`, `[]`/`null` em erro)
- Modify: `apps/web/src/lib/navigation.ts` (item `{ href: "/lotes", label: "Lotes" }` entre Animais e Grupos, com flag `soComInstalacao: true`), `apps/web/src/components/app/sidebar.tsx` + `apps/web/src/app/(app)/layout.tsx` (prop `temInstalacao: boolean` vinda de `getInstalacoes(org.id).length > 0`; itens com a flag só aparecem com `temInstalacao`)
- Modify: `apps/web/src/app/(app)/configuracoes/config-nav.tsx` (aba "Galpões")
- Create: `apps/web/src/app/(app)/configuracoes/galpoes/page.tsx`, `galpoes-lista.tsx` (lista em `Card` + `tabela.*`, "Cadastrar galpão"/"Editar" em `Modal` com `Field`/`Input`/`Select`, mostra `loteAtual`)

- [ ] **Step 1:** Implementar. Sem teste (tela); a regra está nas Tasks 4–5.
- [ ] **Step 2:** `npm run typecheck && npm run lint` → sem erros (fora os da Task 7, se ainda abertos).
- [ ] **Step 3:** Conferir no navegador (`preview_start` "vocare-dev", logado): cadastrar Galpão 1 → menu mostra "Lotes".
- [ ] **Step 4:** Commit `web: cadastro de galpões e item Lotes no menu`.

### Task 10: Web — Lista de lotes

**Files:**
- Create: `apps/web/src/app/(app)/lotes/page.tsx`, `lotes-lista.tsx`, `alojar-modal.tsx`

**Interfaces:**
- Consumes: `getLotes`, `getInstalacoes` (Task 9); `POST /lotes` (Task 5); `criarLoteSchema`.

- [ ] **Step 1:** Implementar: `PageHeader` "Lotes" + `Button` "Alojar lote" (só dono/admin); `Tabs` Ativos/Encerrados; tabela com código, linhagem, galpões, semana, vivas F/M, `posturaOntemPct`, `mortalidadeSemanaPct`; `StatusText tone="aviso"` "Sem apontamento hoje" e `tone="perigo"` "Mortalidade alta hoje"; `EmptyState` sem lotes. `alojar-modal.tsx`: `Field`s do `criarLoteSchema`, linhas de galpão (Select de instalações livres + fêmeas + machos, "Adicionar galpão"), erro da api em `FormMessage`.
- [ ] **Step 2:** typecheck + lint.
- [ ] **Step 3:** Navegador: alojar `L-01` no Galpão 1 → aparece na lista com 1ª semana.
- [ ] **Step 4:** Commit `web: lista de lotes e alojamento`.

### Task 11: Web — Ficha do lote

**Files:**
- Create: `apps/web/src/app/(app)/lotes/[id]/page.tsx`, `ficha-lote.tsx`, `apontamento-modal.tsx`, `acoes-lote.tsx` (transferir, fase, encerrar, pesagem, vacina — um `Modal` cada)

**Interfaces:**
- Consumes: `getLote` (Task 9); rotas da Task 5–6.

- [ ] **Step 1:** Implementar: `PageHeader` (código, linhagem, fase, semana) com ações; faixa de indicadores (vivas F/M, mortalidade acumulada, postura da semana, incubáveis por fêmea, ração g/ave/dia; `null` → "—"); `Tabs` Diário/Semanal/Pesagens/Vacinas com `panelId`; Diário: linha clicável abre `apontamento-modal` (PUT, todos os `CAMPOS_APONTAMENTO` com `ROTULO_CAMPO_APONTAMENTO`), linha com `ocorrenciaId` mostra link "da nota" para `/ocorrencias?id=…`; Semanal imprime (`print:hidden` nas ações). Ações só para dono/admin.
- [ ] **Step 2:** typecheck + lint.
- [ ] **Step 3:** Navegador: lançar 2 dias, conferir indicadores; transferir e encerrar num lote de teste.
- [ ] **Step 4:** Commit `web: ficha do lote`.

### Task 12: Web — Conferência das operações do aviário

**Files:**
- Modify: `apps/web/src/app/(app)/ocorrencias/ocorrencias-view.tsx`, `apps/web/src/app/(app)/ocorrencias/page.tsx`

**Interfaces:**
- Consumes: operações e `CAMPOS_CORRIGIVEIS` (Task 7); `getInstalacoes`, `getLotes(orgId, "ativo")` (Task 9).

- [ ] **Step 1:** Implementar: `Cadastro` ganha `galpoes: Map<id, Instalacao>` e `lotes: Map<id, LoteResumo>` (carregados no `page.tsx`); `nomeAlvo`/`deAlvo`/`efeito` tratam os três tipos ("o apontamento do Galpão 3 em 10/03", "a pesagem das fêmeas do L-07", "a vacina X no L-07"); `formatarCampo`/opções: `instalacaoId` e `loteId` viram `Select`, campos numéricos do apontamento aceitam inteiro (`racaoKg`/`aguaL` decimal com vírgula), `sexo` reaproveita `ROTULO_SEXO`; `CAMPOS_ALVO` inclui `instalacaoId` e `loteId`; todos os campos do apontamento entram em `CAMPOS_OPCIONAIS`.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test` (raiz) → tudo verde (aqui fecha o typecheck aberto na Task 7).
- [ ] **Step 3:** Navegador: inserir uma ocorrência de teste com `apontar_galpao` (pelo teste da Task 8 ou gravando um áudio pelo colar), corrigir um número, confirmar, ver a linha no Diário do lote.
- [ ] **Step 4:** Commit `web: conferir apontamento, pesagem e vacina do lote`.

### Task 13: "Galpões hoje" no Início

**Files:**
- Modify: `apps/api/src/routes/lotes.ts` (`GET /:orgId/galpoes-hoje` → `GalpaoHoje[]`: instalações com alojamento aberto hoje e `apontado` = existe `apontamento_aviario` de hoje), `apps/web/src/app/(app)/dashboard/page.tsx`
- Test: `apps/api/test/lotes.test.ts`

- [ ] **Step 1: Write the failing test:** dois galpões com lote; `PUT` de hoje só no Galpão 1 → `galpoes-hoje` devolve Galpão 1 `apontado: true` e Galpão 2 `apontado: false`; galpão sem lote não aparece; outra fazenda não vê.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** Implementar a rota; no Início, se `getGalpoesHoje` não vier vazio, `SectionHeader` "Galpões hoje" + `Card` com uma linha por galpão (`Dot tone="ok"` "Apontado" / `tone="aviso"` "Sem apontamento") e link para o lote.
- [ ] **Step 4:** `npm test && npm run typecheck && npm run lint` → verde.
- [ ] **Step 5:** Commit `início: galpões apontados e sem apontamento hoje`.

---

**Depois da Task 13:** pedir ao Arthur autorização para `npm run db:migrate` (cria as 6 tabelas no banco compartilhado dev/hom/prod) antes de qualquer teste real com o colar.
