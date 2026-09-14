# VOCare

Gestão de pecuária e atendimento veterinário com registro por voz.

O diferencial do produto é a captura em campo por áudio: o operador fala o que
fez ("apliquei a vacina 2 no boi 3"), o áudio entra numa fila que tolera falta
de sinal, e a IA faz uma **pré-análise** — ela não escreve no sistema, ela
**sugere** um conjunto de operações. Quem administra revisa e confirma; só então
as operações são aplicadas.

## Estrutura

Monorepo com front e back separados, deploy independente:

```
apps/
  web/      Next.js 16 — só interface (porta 3000)
  api/      Hono + Better Auth + Drizzle/Postgres — regra de negócio (porta 4000)
packages/
  shared/   schemas Zod: o contrato entre web e api
```

O navegador fala só com o web. Tudo em `/api/*` é repassado para a api por um
rewrite do Next, então o cookie de sessão é same-origin e não há CORS no
caminho do usuário. Dentro do servidor do Next (Server Components), o web chama
a api direto, repassando o cookie.

## Stack

| Camada        | Escolha                                     |
| ------------- | ------------------------------------------- |
| Web           | Next.js 16 (App Router) + React 19 + TS      |
| Estilo        | Tailwind CSS v4 (tokens em `globals.css`)    |
| API           | Hono 4 + @hono/node-server                   |
| Banco         | Postgres + Drizzle ORM                       |
| Autenticação  | Better Auth (e-mail/senha + organizations)   |
| Contrato      | Zod 4 em `packages/shared`                   |
| Monorepo      | npm workspaces + Turborepo                   |

## Rodando

Precisa de Node 24+ e um Postgres. Uma vez, crie o papel e o banco:

```bash
sudo -u postgres psql -c "CREATE ROLE vocare LOGIN PASSWORD 'vocare';" -c "CREATE DATABASE vocare OWNER vocare;"
```

Depois, na raiz:

```bash
npm install
cp apps/api/.env.example apps/api/.env      # gere o segredo: openssl rand -base64 32
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate                          # aplica as tabelas
npm run seed -- "Fazenda Santa Rita" voce@exemplo.com "sua-senha"
npm run dev                                 # sobe web e api juntos
```

## Autenticação

E-mail e senha via Better Auth, com o plugin `organization` — cada fazenda ou
clínica é uma organização e os usuários são membros dela. É o multi-tenant que
o produto precisa desde o começo. Sessão de 30 dias.

O Better Auth vive **na api**. O web só tem o client (`better-auth/react`) e
um helper de cookie. A proteção de rota no web tem duas camadas, como o guia
do Next 16 recomenda:

- `apps/web/src/proxy.ts` (era `middleware.ts` antes do Next 16) faz a
  checagem **otimista**: só olha se o cookie existe. Roda em toda navegação,
  inclusive prefetch, então nunca chama a api.
- `apps/web/src/lib/auth/dal.ts` faz a checagem **real**: chama
  `GET /api/auth/get-session` na api e valida a resposta contra
  `sessionSchema` do pacote compartilhado.

Cadastro público não existe de propósito: operadores e veterinários são criados
por quem administra a organização (por enquanto, via `npm run seed`).

## Comandos (raiz)

| Comando                  | Faz                                              |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | web + api em paralelo (Turborepo)                |
| `npm run build`          | build dos dois                                   |
| `npm run typecheck`      | `tsc` em todos os workspaces                     |
| `npm run lint`           | eslint no web                                    |
| `npm run db:migrate`     | aplica migrações                                 |
| `npm run db:generate`    | gera migração a partir do schema                 |
| `npm run auth:generate`  | regenera `schema.ts` a partir da config do auth  |
| `npm run seed -- …`      | cria organização + primeiro usuário              |

## Convenções

- O web nunca importa de `apps/api`, e vice-versa. Compartilhado vai para
  `packages/shared`.
- `apps/api/src/db/schema.ts` é **gerado** — não edite à mão. Mudou a config do
  Better Auth? `npm run auth:generate` e depois `npm run db:generate`.
- A cor de marca vive só em `apps/web/src/app/globals.css` (`--color-brand`).
- O nome do produto vive só em `apps/web/src/lib/brand.ts` (`BRAND_NAME`).
