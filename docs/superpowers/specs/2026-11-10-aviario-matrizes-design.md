# Aviário de matrizes — lotes, galpões e apontamento por voz

Data: 2026-11-10 · Sub-projetos 1 (lotes e instalações) e 2 (granja de matrizes) do roadmap do VOCare como ERP de pecuária.

## Objetivo

O primeiro piloto do VOCare como ERP é uma granja de **matrizes (aves reprodutoras) com incubatório**. Este desenho cobre a **granja**; o incubatório é o próximo sub-projeto.

Sucesso do piloto: a granja deixa a planilha. O apontamento diário de cada galpão entra no VOCare pelo **colar** (áudio → IA → nota → conferência humana) ou, como plano B, por lançamento manual, e o gerente vê os indicadores do lote.

### Contexto já decidido

- Público do ERP: fazendas de pecuária + veterinário prestador. Pets/clínica saem do escopo (não neste sub-projeto).
- O colar e o firmware **já existem** e enviam áudio para `POST /api/org/:orgId/ocorrencias` com a sessão do funcionário. Transcrição, análise e ocorrência pendente já funcionam. **Este desenho só estende esse fluxo**: nada de rota, autenticação ou tabela nova para o colar.
- Ainda não se sabe como lote e galpão se relacionam na granja (1 para 1, lote em vários galpões, ou transferência recria → produção). O modelo aceita os três.
- Ainda não se sabe tudo o que a granja vai apontar; entram as quatro famílias (mortalidade/eliminação, ovos, ração/água, pesagem/vacinação) e o que não for usado se desliga depois.

### Fora do escopo

Incubatório, estoque de insumos, financeiro, comparação com curva da linhagem, gráficos, relatório novo, modo offline, mudanças no cadastro de animal individual.

## Abordagem

Lote, instalação e alojamento **genéricos** (servem depois para bovinos: pasto em vez de galpão); apontamento diário **específico** do aviário, em tabela com colunas tipadas. Alternativas descartadas: reusar `grupo` + tabela genérica de eventos (indicadores frágeis, `grupo` é lista de animais individuais) e tabelas só de aviário (refazer tudo para bovinos).

## Modelo de dados

Arquivo novo `apps/api/src/db/lotes.ts`, no padrão de `db/historico.ts`: `id` uuid, `organizationId` (cascade), `criadoPorId` (set null), `createdAt`; tabelas que podem vir de uma nota têm `ocorrenciaId` (set null). Uma migration em `apps/api/drizzle/`.

| Tabela | Campos | Regras |
|---|---|---|
| `instalacao` | `nome`, `tipo` (`galpao` \| `pasto` \| `baia` \| `incubadora`), `capacidade?`, `areaM2?`, `ativa` | Nome único por organização. No piloto só `galpao`. |
| `lote` | `codigo`, `especie`, `linhagem?`, `dataAlojamento`, `idadeAlojamentoDias` (default 0), `femeasIniciais`, `machosIniciais`, `fase` (`recria` \| `producao`), `situacao` (`ativo` \| `encerrado`), `dataEncerramento?` | Código único por organização. |
| `alojamento` | `loteId`, `instalacaoId`, `inicio`, `fim?`, `femeas`, `machos` | Uma instalação não tem dois alojamentos com períodos sobrepostos. `fim` vazio = ainda alojado. |
| `apontamento_aviario` | `instalacaoId`, `loteId`, `data`, `mortasFemeas?`, `mortasMachos?`, `eliminadasFemeas?`, `eliminadasMachos?`, `ovosTotal?`, `ovosIncubaveis?`, `ovosTrincados?`, `ovosSujos?`, `ovosDuasGemas?`, `ovosDescarte?`, `racaoKg?`, `aguaL?`, `observacoes?`, `ocorrenciaId?` | Único por (`instalacaoId`, `data`). `loteId` vem do alojamento aberto na data. Inteiros ≥ 0; `racaoKg`/`aguaL` numéricos ≥ 0. |
| `pesagem_lote` | `loteId`, `instalacaoId?`, `data`, `sexo` (`femea` \| `macho`), `pesoMedioG`, `uniformidadePct?` (0–100), `amostra?` | |
| `vacinacao_lote` | `loteId`, `vacina`, `via?`, `data`, `proximaData?` | Separada de `vacina` (que exige `animalId`), para não mexer no que funciona. |

Índices: `alojamento (instalacaoId, inicio)`, `apontamento_aviario (loteId, data)`, `pesagem_lote (loteId, data)`, `vacinacao_lote (organizationId, proximaData)`.

### Indicadores (calculados, não gravados)

Funções puras em `packages/shared/src/indicadores-lote.ts`:

- **semana de vida** = ⌊(data − dataAlojamento + idadeAlojamentoDias) / 7⌋ + 1
- **aves vivas** (por sexo) = iniciais − Σ mortas − Σ eliminadas até a data
- **mortalidade** do dia, da semana e acumulada (% sobre iniciais)
- **% postura** = ovosTotal ÷ fêmeas vivas no dia
- **% incubáveis** = ovosIncubaveis ÷ ovosTotal
- **incubáveis por fêmea alojada** (acumulado) = Σ ovosIncubaveis ÷ femeasIniciais
- **ração g/ave/dia** = racaoKg × 1000 ÷ aves vivas
- **relação água/ração** = aguaL ÷ racaoKg

Divisão por zero (sem aves, sem ovos, sem ração) devolve `null`; a tela mostra "—".

## Fluxo do colar (extensão do existente)

1. **Entrada**: sem mudança. O colar continua postando em `POST /api/org/:orgId/ocorrencias`.
2. **Análise** (`apps/api/src/ia/analisar.ts`): passa a receber também os galpões com lote alojado na data (nome do galpão, código do lote, semana de vida, fêmeas e machos vivos). Três operações novas em `operacaoSchema` (`packages/shared/src/ocorrencias.ts`):
   - `apontar_galpao`: `instalacaoId`, `data` e qualquer subconjunto dos campos do apontamento;
   - `pesar_lote`: `loteId`, `sexo`, `pesoMedioG`, `uniformidadePct?`, `amostra?`, `data`;
   - `vacinar_lote`: `loteId`, `vacina`, `via?`, `data`, `proximaData?`.
   As operações de aviário só entram no prompt se a organização tem lote ativo. Um áudio pode gerar várias operações (um `apontar_galpao` por galpão citado).
3. **Conferência** (tela de Ocorrências): as operações novas ganham editores de campos, como os de peso e vacina; quem confere edita, troca o galpão ou remove a operação.
4. **Confirmação** (`POST /:orgId/ocorrencias/:id/confirmar`), numa transação, tudo ou nada:
   - `apontar_galpao` → resolve o lote pelo alojamento aberto na data e **soma** na linha do galpão/dia, criando se não existir, com `INSERT … ON CONFLICT (instalacao_id, data) DO UPDATE SET campo = coalesce(campo, 0) + excluded.campo` (campos vazios não mexem no valor).
   - `pesar_lote` / `vacinar_lote` → inserem nas tabelas do lote.
   - Todas gravam `ocorrenciaId` e `criadoPorId`.

Correção depois de aprovado: pela ficha do lote, editando o apontamento do dia (substitui os valores, não soma).

## API nova

Todas em `apps/api/src/routes/lotes.ts`, montadas em `/api/org`, começando por `membroAtual` e filtrando por `organizationId`.

| Rota | Quem |
|---|---|
| `GET/POST /:orgId/instalacoes`, `PATCH /:orgId/instalacoes/:id` | ler: membro; criar/editar: dono/admin |
| `GET /:orgId/lotes?situacao=`, `POST /:orgId/lotes` (cria lote + alojamentos iniciais) | ler: membro; criar: dono/admin |
| `GET /:orgId/lotes/:id` (lote, alojamentos, indicadores, diário, semanal, pesagens, vacinas) | membro |
| `POST /:orgId/lotes/:id/transferir`, `/fase`, `/encerrar` | dono/admin |
| `PUT /:orgId/lotes/:id/apontamentos/:instalacaoId/:data` (lançamento/edição manual, substitui) | dono/admin (mesma regra `PODE_SALVAR` do `/confirmar`) |
| `POST /:orgId/lotes/:id/pesagens`, `/vacinacoes` | dono/admin (mesma regra `PODE_SALVAR` do `/confirmar`) |
| `GET /:orgId/galpoes-hoje` (para o Início) | membro |

Contratos (entrada e saída) em `packages/shared/src/lotes.ts`.

## Telas (com o kit `@/components/ui`)

- **Menu**: item **Lotes** entre Animais e Grupos, só se a organização tem instalação cadastrada.
- **`/lotes`**: lotes ativos (código, linhagem, galpões, semana, fêmeas/machos vivos, % postura de ontem, mortalidade da semana), com `StatusText` para "sem apontamento hoje" e mortalidade alta no dia; aba **Encerrados**; botão **Alojar lote** (diálogo: código, linhagem, data, idade no alojamento, fêmeas, machos, galpões com quantidades).
- **`/lotes/[id]`**: `PageHeader` (código, linhagem, fase, semana) + faixa de indicadores; abas **Diário** (por dia × galpão; clique edita; marca se veio de nota, com link, ou de lançamento manual), **Semanal** (consolidado por semana de vida, com peso médio e uniformidade por sexo), **Pesagens**, **Vacinas**; ações *Lançar apontamento*, *Transferir de galpão*, *Mudar fase*, *Encerrar lote*.
- **Configurações → Galpões**: cadastro de instalações e quem ocupa cada uma agora.
- **Início**: bloco **Galpões hoje** (quais galpões ativos têm e não têm apontamento hoje), só com lote ativo.
- **Ocorrências**: editores das três operações novas.

"Mortalidade alta no dia" no piloto = mortas + eliminadas do dia > 0,1% das aves vivas do galpão. Valor fixo em `shared`, ajustável depois.

## Erros e regras

- Galpão sem lote alojado na data da operação → na confirmação de ocorrência, **400** (padrão atual do `/confirmar` para qualquer falha de aplicação), nada gravado, mensagem com galpão e data; no lançamento manual, **422**.
- Alojamento sobreposto na mesma instalação → **409**.
- Lote encerrado → recusa apontamento, pesagem e vacinação com data depois do encerramento (**422**).
- Valores negativos, data futura, uniformidade fora de 0–100 → **400** (Zod).
- Numa mesma operação, soma das classes de ovo (`incubaveis + trincados + sujos + duasGemas + descarte`) > `ovosTotal` → **400**.
- Mortas + eliminadas do dia > aves vivas do galpão → **422**.
- Recurso de outra organização → **404** (não revela que existe).

## Testes

No mesmo commit de cada passo, `npm test` verde.

- `packages/shared/src/indicadores-lote.test.ts`: cada indicador, incluindo divisões por zero e semana de vida com idade no alojamento.
- `packages/shared/src/lotes.test.ts`: schemas de instalação, lote, apontamento e das três operações (limites, classes > total, campos vazios).
- `apps/api/test/lotes.test.ts` (com `criarFazenda` e `chamar`):
  - instalação e lote: dono cria; membro comum não cria; outra organização não lê nem altera; alojamento sobreposto → 409;
  - transferência: fecha um alojamento, abre outro; apontamento de cada data vai para o lote certo;
  - lançamento manual substitui; lote encerrado recusa.
- `apps/api/test/ocorrencias-aviario.test.ts`:
  - confirmar `apontar_galpao` cria a linha; segunda confirmação soma; galpão sem lote → 422 sem gravar nada; ocorrência de outra organização recusada;
  - `pesar_lote` e `vacinar_lote` gravam no lote certo;
  - `analisar()` com provedor simulado: galpões entram no contexto e resposta com `apontar_galpao` é validada.
- `GET /lotes/:id`: indicadores esperados para um lote de exemplo com alguns dias de apontamento.

Telas sem teste (regra do `CLAUDE.md`); a regra por trás delas está coberta acima.

## Ordem de entrega

1. Tabelas e migration, contratos em `shared`, indicadores — com testes.
2. Rotas de instalações e lotes + tela Configurações → Galpões.
3. Operações da IA, editores na conferência e gravação no `/confirmar`.
4. Telas `/lotes` e `/lotes/[id]`.
5. Bloco "Galpões hoje" no Início.

**Migration**: dev, hom e prod usam o mesmo banco. `npm run db:migrate` só roda com autorização explícita do Arthur na hora.
