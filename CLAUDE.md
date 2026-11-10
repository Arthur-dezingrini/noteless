# VOCare — monorepo

Gestão de pecuária/veterinária com registro por voz. Front e back são
aplicações separadas, com deploy independente:

- `apps/web` — Next.js 16. Só interface. **Antes de mexer aqui, leia
  `apps/web/AGENTS.md`**: esta versão do Next tem mudanças incompatíveis com
  o que você conhece (ex.: `middleware.ts` virou `proxy.ts`).
- `apps/api` — Hono + Better Auth + Drizzle/Postgres. Toda a regra de negócio.
- `packages/shared` — schemas Zod que definem o contrato entre os dois. Tudo
  que atravessa a fronteira HTTP passa por aqui.

## Regras

- O web nunca importa de `apps/api`, e vice-versa. Se precisa compartilhar,
  vai para `packages/shared`.
- No web, sessão é verificada em `src/lib/auth/dal.ts` (contra a api), não no
  proxy — o proxy é só checagem otimista de cookie.
- `apps/api/src/db/schema.ts` é gerado (`npm run auth:generate`); não edite à mão.
- Cor de marca em `apps/web/src/app/globals.css`; nome do produto em
  `apps/web/src/lib/brand.ts`. Um lugar cada.
- Na tela é **nota** (página `/notas`); no código, no banco e na api continua
  `ocorrencia` — `/api/org/:orgId/ocorrencias` é o que o gravador chama. Não
  renomeie; texto novo para quem usa diz "nota".
- **Toda funcionalidade nova vem com teste, no mesmo commit.** Rota nova ou
  regra nova na api → teste em `apps/api/test/<modulo>/`, cobrindo o caminho feliz e
  quem NÃO pode (outro papel, outra organização). Schema ou função pura →
  `x.test.ts` ao lado. Correção de bug → teste que falhava antes da correção.
  Tela (componente React) fica de fora por enquanto; a regra por trás dela não.
  `npm test` verde antes de commitar — o CI barra se não estiver.

## Estrutura por módulo

Sete módulos: `aviario`, `notas`, `animais`, `saude`, `conta`, `avisos`,
`painel` (só lê os outros). Cada um tem pasta nos três pacotes, com o mesmo
esqueleto:

- **api** `src/modulos/<m>/`: `rotas/` (só HTTP), `regras/` (decide e grava;
  devolve `Resultado` de `base/resultado.ts`), `consultas/` (leituras
  montadas), `index.ts`. Tabelas em `src/db/tabelas/<m>.ts`; o comum a todos
  em `src/base/`. Teste de rota em `test/<m>/`.
- **web** `src/modulos/<m>/`: `componentes/`, `dados.ts` (busca na api,
  server-only), `index.ts`. `app/` só tem páginas finas.
- **shared** `src/<m>/` com `index.ts`; continua tudo em `@vocare/shared`.
- **Menu:** cada módulo do web declara o seu em `menu.ts` (telas, e as que
  ainda não existem com `emBreve`); módulo novo é uma pasta com `menu.ts`
  registrada em `MENU` (`src/lib/navigation.ts`). Tela mora no endereço do
  módulo (`/aviario/lotes`); endereço que mudar ganha redirect em
  `next.config.ts`.
- Fora do módulo, só se entra pelo `index.ts` (no web, também pelo `dados`,
  nunca a partir de `"use client"`). Sem ciclo entre módulos. Arquivo acima
  de ~300 linhas se divide pelo assunto. Código novo nasce no seu módulo.
- `apps/api/test/estrutura.test.ts` e `apps/web/src/modulos/estrutura.test.ts`
  barram import errado e ciclo.

## Comandos (na raiz)

- `npm run dev` — sobe web (:3000) e api (:4000) juntos via Turborepo
- `npm run build` / `npm run lint` / `npm run typecheck`
- `npm test` — Vitest. Função pura: `x.ts` → `x.test.ts` ao lado. Rota da api:
  `apps/api/test/<modulo>/`, contra Postgres em memória (PGlite); use `criarFazenda` e
  `chamar` de `test/ajuda.ts`.
- `npm run db:migrate` / `npm run seed -- "<org>" <email> <senha>`
