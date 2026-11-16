# Noteless

Gestão de pecuária e atendimento veterinário com registro por voz.

Quem está no campo fala o que fez ("vacinei a Mimosa contra aftosa, segunda
dose") num gravador de bolso. O áudio entra numa fila que tolera falta de
sinal, é transcrito, e uma IA **propõe** as operações que a fala pede. Um
administrador confere e salva; só então algo entra no sistema.

- **Demonstração:** https://vocare-iota.vercel.app
- **Documentação técnica:** [docs/](docs/README.md) — arquitetura, modelo de
  dados, segurança, LGPD, IA e infraestrutura

## Módulos

| Módulo | O que tem |
| --- | --- |
| Notas | áudio → transcrição → operações propostas → conferência → salvar |
| Animais | cadastro, grupos, ficha com pesagens, vacinas, tratamentos, partos e anotações |
| Saúde | agenda de consultas e prontuários |
| Aviário | galpões, lotes, alojamento, apontamento diário, pesagem e vacinação de lote |
| Avisos | notificações e tela ao vivo |
| Painel | Início e relatórios |
| Conta | usuários e papéis por empresa, perfil, super usuário, gravadores de campo |

## Stack

| Camada | Escolha |
| --- | --- |
| Web | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilo | Tailwind CSS v4 (tokens em `apps/web/src/app/globals.css`) |
| API | Hono 4 |
| Banco | PostgreSQL no Neon + Drizzle ORM |
| Autenticação | Better Auth (e-mail/senha + organizações) |
| Contrato | Zod 4 em `packages/shared` |
| IA | Whisper (transcrição) + LLM com tool calling (Groq; Claude opcional) |
| Testes | Vitest + PGlite (Postgres em memória) |
| Monorepo | npm workspaces + Turborepo |
| Deploy | Vercel (dois projetos) |
| Gravador | ESP32 (Arduino), em `firmware/` |

```
apps/
  web/        Next.js — só interface (porta 3000)
  api/        Hono + Better Auth + Drizzle — regra de negócio (porta 4000)
packages/
  shared/     schemas Zod: o contrato entre web e api
firmware/     gravador de campo (ESP32) e placa própria (KiCad)
docs/         documentação técnica, specs e planos
```

O navegador fala só com o web; `/api/*` é repassado para a api por um rewrite
do Next. Detalhes em [docs/arquitetura.md](docs/arquitetura.md).

## Instalação e execução

### Pré-requisitos

- **Node.js 24** ou mais novo (npm 11)
- Acesso ao banco: a `DATABASE_URL` do Neon e o `BETTER_AUTH_SECRET` do
  time. Peça **por mensagem privada** — nunca no git, nunca no grupo.
- Para a IA: uma `GROQ_API_KEY` (grátis em console.groq.com). Sem ela tudo
  funciona, menos a gravação, que responde dizendo o que falta.

### Passo a passo

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

Preencha em `apps/api/.env` a `DATABASE_URL`, o `BETTER_AUTH_SECRET` e a
`GROQ_API_KEY`. Os outros valores do exemplo já servem para rodar local.

```bash
npm run db:migrate
```

```bash
npm run dev
```

Abra http://localhost:3000. A api responde em http://localhost:4000 e, ao
subir, imprime qual arquivo de ambiente carregou e o host do banco.

**Banco novo?** Crie a empresa e o primeiro usuário:
`npm run seed -- "Fazenda Santa Rita" voce@exemplo.com "sua-senha"`. No banco
compartilhado do time isso já foi feito.

### Variáveis de ambiente

| Onde | Variável | Obrigatória | O que é |
| --- | --- | :-: | --- |
| api | `DATABASE_URL` | sim | connection string do Neon |
| api | `BETTER_AUTH_SECRET` | sim | segredo das sessões (≥ 32 caracteres); o mesmo para o time todo |
| api | `BETTER_AUTH_URL` | sim | por onde o navegador chega na api (local: `http://localhost:4000`; na Vercel: a URL do web) |
| api | `WEB_URL` | sim | origem do front (local: `http://localhost:3000`) |
| api | `GROQ_API_KEY` | para a IA | transcrição e interpretação |
| api | `ANTHROPIC_API_KEY`, `IA_MODELO`, `TRANSCRICAO_*`, `ORIGENS_EXTRAS` | não | ver `apps/api/.env.example` |
| web | `API_URL` | na Vercel | URL da api (local: `http://localhost:4000`) |

Lista completa e explicada em [docs/infraestrutura.md](docs/infraestrutura.md#4-variáveis-de-ambiente).

## Comandos (na raiz)

| Comando | Faz |
| --- | --- |
| `npm run dev` | web + api contra o banco principal |
| `npm run dev:hom` | idem, contra o branch de homologação (`apps/api/.env.hom`) |
| `npm test` | testes (Vitest): shared, web e rotas da api |
| `npm run lint` / `npm run typecheck` | lint e tipos em todos os pacotes |
| `npm run build` | build dos dois apps |
| `npm run db:migrate` | aplica migrações no principal (`db:migrate:hom` na homologação) |
| `npm run db:generate` | gera migração a partir das tabelas |
| `npm run auth:generate` | regenera `apps/api/src/db/schema.ts` a partir da config do Better Auth |
| `npm run seed -- …` | cria empresa + primeiro usuário (`seed:hom`) |
| `npm run super -w @vocare/api -- <email>` | promove alguém a super usuário |
| `npm run avaliar -w @vocare/api` | mede a IA contra o conjunto de casos (gasta cota) |

## Ambientes

| Comando | Arquivo | Banco |
| --- | --- | --- |
| `npm run dev` | `apps/api/.env` | branch principal do Neon |
| `npm run dev:hom` | `apps/api/.env.hom` | branch de homologação |

`.env.hom` é uma cópia do `.env` com a `DATABASE_URL` do branch de
homologação. Se ele não existir, `dev:hom` se recusa a subir. Os dois são
ignorados pelo git.

**Mudou o esquema?** `npm run db:generate`, teste com `npm run db:migrate:hom`,
commite `apps/api/drizzle/` junto com o código e avise o time. Migração
destrutiva só vai para o principal depois que o código novo estiver
publicado.

**Por que o driver do Neon e não `pg`?** Ele fala com o banco por WebSocket
na porta 443; a 5432 é bloqueada em muita rede de universidade e empresa.

## Deploy

Dois projetos na Vercel, do mesmo repositório; push na `main` publica os dois.

| | api | web |
| --- | --- | --- |
| Root Directory | `apps/api` | `apps/web` |
| Preset | Hono | Next.js |
| Variáveis | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GROQ_API_KEY`, `WEB_URL` e `BETTER_AUTH_URL` (as duas = URL do web) | `API_URL` |
| Região | São Paulo (gru1) | São Paulo (gru1) |

Migração não roda no deploy: aplique antes de publicar código que dependa
dela. Passo a passo da primeira vez em
[docs/infraestrutura.md](docs/infraestrutura.md#2-deploy).

## Autenticação e papéis (resumo)

- E-mail e senha pelo Better Auth, que vive na api. **Não há cadastro
  público**: usuários são criados por um administrador da empresa, em
  Configurações › Usuários.
- Cada fazenda ou clínica é uma organização. Um usuário pode estar em várias e
  troca no seletor do menu.
- Papéis: `owner` (dono), `admin` (gerencia usuários e salva notas) e `member`
  (opera e confere). Super usuário administra a plataforma.
- No web, `src/proxy.ts` só checa se o cookie existe; a checagem de verdade é
  em `src/lib/auth/dal.ts`, contra a api.

Detalhes e matriz de permissões em [docs/seguranca.md](docs/seguranca.md).

## Testes

- Função pura: `x.ts` → `x.test.ts` ao lado.
- Rotas da api: `apps/api/test/<módulo>/`, contra um Postgres em memória
  (PGlite) com as mesmas migrações. Sem Neon, sem internet e sem chave de IA.
  `test/ajuda.ts` cria uma fazenda com dono, admin e membro já logados.
- O CI (`.github/workflows/ci.yml`) roda lint, tipos, testes e build em todo
  push e pull request.

## Convenções

- O web nunca importa de `apps/api`, e vice-versa. O que os dois precisam vai
  para `packages/shared`.
- Código por módulo: `apps/api/src/modulos/<m>/` (rotas, regras, consultas),
  `apps/web/src/modulos/<m>/` (componentes, dados, menu),
  `packages/shared/src/<m>/`. Fora do módulo, só pelo `index.ts`. Testes de
  estrutura barram import errado e ciclo.
- `apps/api/src/db/schema.ts` é **gerado** — não edite à mão. Tabelas de
  negócio em `apps/api/src/db/tabelas/<módulo>.ts`.
- Na tela é **nota**; no código, no banco e na api continua `ocorrencia`.
- A cor da marca vive só em `apps/web/src/app/globals.css`; o nome do produto,
  só em `apps/web/src/lib/brand.ts`.
- **Toda funcionalidade nova vem com teste, no mesmo commit** — o caminho
  feliz e quem não pode (outro papel, outra empresa). `npm test` verde antes
  de commitar.

Mais regras para quem programa (inclusive assistentes de IA) em
[CLAUDE.md](CLAUDE.md).

## Gravador de campo

Código e instruções em [firmware/README.md](firmware/README.md). A placa é
aprovada por um super usuário em Configurações › Gravadores, com o código que
ela mostra.
