# Modularização por domínio — design

**Data:** 2026-11-10
**Pedido:** "quero que fique modularizado, para ficar cada coisa em seu lugar, e ter um padrão."
**Decisões do Arthur:**
- Organizar o código por módulo de domínio na api, no web e no shared. O visual das telas fica de fora.
- Mover os arquivos para as pastas dos módulos e quebrar os arquivos grandes.

## Objetivo

Cada assunto do sistema mora numa pasta só e segue o mesmo esqueleto, na api, no web e no shared. Quem procura "onde fica a regra de transferência de lote" sabe onde olhar sem abrir arquivo.

**Nada muda no comportamento.** Continuam iguais as rotas HTTP, os contratos Zod, as telas, as mensagens, o banco e as migrations.

## Fora do escopo

- Funcionalidade nova, correção de bug ou mudança de texto na tela.
- Mudar o visual das telas.
- Pacote npm por módulo.
- Trocar biblioteca ou padrão técnico (Hono, Drizzle, Next, Zod e o kit UI continuam).

## Módulos

| Módulo | Assunto |
|---|---|
| `aviario` | galpões (instalações), lotes, alojamento, transferência, apontamentos diários, pesagem e vacinação de lote |
| `notas` | ocorrências (nota na tela), gravação, IA (transcrever, analisar), anotações do animal |
| `animais` | animais, grupos, ficha do animal, histórico (pesagem, vacina, tratamento, parto) |
| `saude` | consultas, prontuários, agenda |
| `conta` | perfil, usuários e membros da organização |
| `avisos` | notificações, novidades e tela ao vivo |
| `painel` | início (avisos do dia) e relatórios; só leem os outros módulos |

## Esqueleto de um módulo

### api — `apps/api/src/modulos/<modulo>/`

| Arquivo | Papel |
|---|---|
| `rotas.ts` | Só HTTP: lê o pedido, chama `membroAtual`, valida com o schema do shared, chama a regra e responde. Num módulo grande vira a pasta `rotas/`, com um arquivo por recurso, e `rotas/index.ts` junta tudo num `Hono`. |
| `regras/` | Regra de negócio que grava ou decide (ex.: `aviario/regras/alojamento.ts`). Recebe `tx`/`db` e dados já validados; não conhece `Context` do Hono. |
| `consultas/` | Leituras montadas para a tela (ex.: ficha, resumo). Basta um arquivo `consultas.ts` quando for só um. |
| `index.ts` | O que o módulo expõe: as rotas (para o `app.ts`) e o que outros módulos podem usar. |

Pasta ou arquivo que não tem conteúdo não é criado: módulo sem regra não ganha `regras/` vazio.

**Ficam onde estão,** porque scripts e ferramentas apontam para esses caminhos:
- `src/app.ts`, `src/index.ts`, `src/env.ts`, `src/load-env.ts`, `src/auth.ts`;
- `src/db/index.ts`, `src/db/schema.ts` (gerado), `src/db/seed.ts`.

**Tabelas: `src/db/tabelas/<modulo>.ts`.** As tabelas são separadas por módulo, mas ficam numa camada comum e qualquer módulo as importa direto. Dois motivos:
- várias leituras cruzam módulos: a ficha do animal lê anotações e consultas, relatórios leem tudo, e as notas gravam no histórico dos animais;
- o Drizzle precisa de um schema único.

Com as tabelas dentro dos módulos, `animais` ↔ `notas` e `animais` ↔ `saude` virariam dependência circular. Regra e consulta, ao contrário, ficam no módulo dono.

**`src/base/`** guarda o que todos os módulos usam:
- `datas.ts`;
- `membro-atual.ts`, a permissão.

O provedor de IA vai para `notas`, que é o único módulo que o usa.

### web — `apps/web/src/modulos/<modulo>/`

| Arquivo | Papel |
|---|---|
| `componentes/` | Telas do módulo, quebradas por bloco. Uma subpasta por tela quando ela tem vários blocos (ex.: `notas/componentes/editor/`). |
| `dados.ts` | Funções server-only que buscam na api (`getLotes`, `getOcorrencias`...), tiradas de `lib/auth/dal.ts`. Usam a sessão do `dal.ts`. |
| `index.ts` | O que as páginas e outros módulos usam. |

O `app/` continua com as rotas do Next, mas cada `page.tsx` e `layout.tsx` fica fino: busca pelo `dados.ts` do módulo e entrega para o componente do módulo.

O `lib/auth/dal.ts` fica com:
- a sessão (`getSession`, `requireSession`);
- a organização (`getOrganizations`, `getOrgAtiva`, `getMemberRole`, `rotuloPapel`).

O CLAUDE.md continua valendo: a sessão é verificada no `dal.ts`.

**Ficam onde estão:**
- `components/ui` (kit) e `components/app` (casca: sidebar, header, troca de organização);
- `lib/` com o que é transversal (`api.ts`, `api-client.ts`, `brand.ts`, `navigation.ts`, `datas.ts`, `json.ts`).

O catálogo do kit (`app/(app)/kit/kit-view.tsx`) vai para `components/ui/catalogo.tsx`.

### shared — `packages/shared/src/<modulo>/`

- Cada módulo tem seu `index.ts`.
- `src/index.ts` re-exporta os módulos.
- Quem usa continua importando de `@vocare/shared`, sem mudança.

## Onde cada arquivo vai

### api

| Hoje | Vai para |
|---|---|
| `routes/lotes.ts` (592 linhas) | `modulos/aviario/rotas/`:<br>• `galpoes.ts` (instalações, galpões hoje)<br>• `lotes.ts` (CRUD, fase, encerrar, reabrir, transferir, desfazer)<br>• `registros.ts` (apontamentos, pesagens, vacinações) |
| `db/lotes.ts` | `db/tabelas/aviario.ts` |
| `lotes/alojamento.ts`, `apontamento.ts`, `aplicar.ts` | `modulos/aviario/regras/` |
| `lotes/ficha.ts`, `resumo.ts`, `galpoes-ia.ts` | `modulos/aviario/consultas/` |
| `routes/ocorrencias.ts` (515 linhas) | `modulos/notas/`:<br>• `rotas.ts`<br>• `regras/aplicar.ts` (aplicar operação confirmada)<br>• `regras/gravacao.ts` (`quandoFoiGravado`) |
| `db/ocorrencias.ts` (`ocorrencia`, `ocorrenciaAudio`, `anotacaoAnimal`) | `db/tabelas/notas.ts` |
| `ia/analisar.ts`, `transcrever.ts`, `provedor.ts` | `modulos/notas/ia/` |
| `routes/animais.ts`, `ficha.ts`, `grupos.ts` | `modulos/animais/rotas/` |
| `db/animais.ts` e a parte animal de `db/historico.ts` (`pesagem`, `vacina`, `tratamento`, `parto`, `grupo`, `grupoAnimal`) | `db/tabelas/animais.ts` |
| `notificacao` (hoje em `db/historico.ts`) | `db/tabelas/avisos.ts` |
| `routes/consultas.ts`, `prontuarios.ts` (307 linhas) | `modulos/saude/rotas/`; a regra do prontuário vai para `regras/` |
| `db/consultas.ts` (`consulta`, `prontuario`) | `db/tabelas/saude.ts` |
| `routes/perfil.ts`, `usuarios.ts`, `usuarios/criar-usuario.ts` | `modulos/conta/` (`rotas/`, `regras/criar-usuario.ts`) |
| `routes/notificacoes.ts`, `novidades.ts`, `notificacoes/notificar.ts` | `modulos/avisos/` (`rotas/`, `regras/notificar.ts`) |
| `routes/inicio.ts`, `relatorios.ts` | `modulos/painel/rotas/` |
| `datas.ts`, `membros/membro-atual.ts` | `base/` |

- **Drizzle:** o `schema` do `drizzle.config.ts` passa a ser `./src/db/schema.ts` mais `./src/db/tabelas/*.ts`. As tabelas só mudam de arquivo; o SQL é o mesmo.
- **Testes de rota:** `apps/api/test/<modulo>/`. `ajuda.ts` e `setup.ts` ficam em `test/`. O `include` do vitest (`test/**/*.test.ts`) já pega subpastas.

### web

| Hoje (`app/(app)/…`) | Vai para `modulos/…` |
|---|---|
| `lotes/*`, `lotes/[id]/*`, `configuracoes/galpoes/galpoes-lista.tsx` | `aviario/componentes/`:<br>• `acoes-lote.tsx` (358) é quebrado por ação<br>• `ficha-lote.tsx` (337) é quebrado por bloco |
| bloco "Galpões hoje" do `dashboard/page.tsx` | `aviario/componentes/galpoes-hoje.tsx` |
| `notas/notas-view.tsx` (1009) | `notas/componentes/`:<br>• lista<br>• abas<br>• editor da nota<br>• um editor por tipo de operação (animal, aviário, consulta…) |
| `animais/*`, `animais/[id]/ficha-view.tsx`, `grupos/*` | `animais/componentes/`; `grupos-view.tsx` (364) é quebrado |
| `agenda/*`, `prontuarios/*` | `saude/componentes/`:<br>• `agenda-view.tsx` (609) é quebrado<br>• `prontuario-modal.tsx` (337) é quebrado |
| `perfil/perfil-form.tsx`, `configuracoes/conta-form.tsx`, `configuracoes/config-nav.tsx`, `configuracoes/usuarios/usuarios-lista.tsx` (424) | `conta/componentes/`; `usuarios-lista` é quebrado |
| `components/app/ao-vivo.tsx`, `lib/ao-vivo.ts` (+ teste) | `avisos/` |
| conteúdo do `dashboard/page.tsx`, `relatorios/relatorios-view.tsx` | `painel/componentes/` |

As funções `get*` do `dal.ts` vão para o `dados.ts` do módulo dono:
- `getLotes`, `getLote`, `getInstalacoes`, `getGalpoesHoje` → aviario;
- `getOcorrencias` → notas;
- `getAnimais`, `getFicha`, `getGrupos` → animais;
- `getConsultas`, `getProntuarios` → saude;
- `getUsuarios` → conta;
- `getNotificacoes`, `getNovidades` → avisos;
- `getAvisos`, `getRelatorio` → painel.

### shared

| Hoje | Vai para |
|---|---|
| `lotes.ts`, `indicadores-lote.ts` (+ testes) | `aviario/` |
| `ocorrencias.ts` (+ teste) | `notas/` |
| `animais.ts` (+ teste), `ficha.ts`, `grupos.ts` | `animais/` |
| `consultas.ts`, `prontuarios.ts`, `agenda-prontuario.test.ts` | `saude/` |
| `auth.ts`, `usuarios.ts` | `conta/` |
| `notificacoes.ts`, `novidades.ts` | `avisos/` |
| `inicio.ts`, `relatorios.ts` | `painel/` |

## Regras do padrão

1. **Um módulo só importa outro pelo `index.ts` dele.** Exemplos:
   - `notas` usa `aplicarAviario` e `galpoesDaOrg` de `modulos/aviario`, nunca de `modulos/aviario/regras/aplicar`;
   - `painel` lê de vários módulos do mesmo jeito.

   Dentro do próprio módulo, o import é direto. As tabelas (`src/db/tabelas/*`) não são módulo: qualquer um importa.
2. **Arquivo acima de ~300 linhas é dividido por responsabilidade:** um recurso por arquivo de rota, um bloco por componente. O limite é orientação, não corte cego: a divisão segue o assunto, nunca a contagem de linhas.
3. **Sem dependência circular entre módulos.** Os sentidos permitidos hoje:
   - `notas` → `aviario` (`aplicarAviario`, `galpoesDaOrg`) e `avisos` (`notificar`);
   - `painel` → todos.

   Hoje `lotes/galpoes-ia.ts` importa o tipo `GalpaoParaIa` de `ia/analisar`, o que faria `aviario` → `notas` e fecharia um ciclo. O tipo passa a ser definido em `aviario` e importado por `notas/ia/analisar.ts`.

   `base` não importa módulo nenhum.
4. **Código novo nasce na pasta do seu módulo,** com o mesmo esqueleto.

### Teste que guarda o padrão

A regra 1 vira teste, porque o CLAUDE.md pede teste para regra nova:
- `apps/api/test/estrutura.test.ts` e `apps/web/src/modulos/estrutura.test.ts` leem os arquivos de `modulos/`;
- falham se algum import de outro módulo passar do `index.ts` dele;
- usam só `fs` e Vitest, sem dependência nova;
- o teste nasce no passo `base`, junto com o primeiro módulo movido, e falha se for plantado um import proibido.

## Trabalho em andamento do Arthur

Estes arquivos não são commitados nem reformatados: `apps/api/src/ia/avaliar.ts`, `apps/api/test/avaliar.test.ts`, `apps/api/avaliacao/` e as mudanças em `apps/api/package.json` e `tsconfig.json`.

Mesmo assim eles importam de `src/ia/`. Quando `ia/` mudar de lugar no passo `notas`:
- `avaliar.ts` vai para `modulos/notas/ia/avaliar.ts`, ainda sem commitar;
- os imports desses arquivos passam a apontar para os caminhos novos.

Só as linhas de import mudam. Assim o trabalho continua compilando, e continua sendo dele para commitar.

## Como entregar

Um commit por passo, direto na `main`:
1. `base`, com o teste de estrutura;
2. `aviario`, o modelo;
3. `notas`;
4. `animais`;
5. `saude`;
6. `conta`;
7. `avisos`;
8. `painel`;
9. a seção "Estrutura por módulo" no `CLAUDE.md`.

Cada passo cobre os três pacotes (api, web, shared) daquele módulo.

Antes de cada commit:
- `npm run typecheck`, `npm run lint` e `npm test` verdes;
- `npm run build` no último passo de cada pacote;
- nos passos que movem tabelas, `drizzle-kit generate` precisa responder que não há mudança de schema. Esse comando gera arquivo, não grava no banco; se gerar migration, o passo está errado.

**Conferência final:**
- todas as rotas da api respondem como antes, garantido pelos testes existentes, que não mudam de conteúdo, só de pasta;
- as telas abrem no navegador depois do login do Arthur: início, notas, animais, lotes, agenda, relatórios e configurações.
