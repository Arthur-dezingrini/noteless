# VOCare

Gestão de pecuária e atendimento veterinário com registro por voz.

O diferencial do produto é a captura em campo por áudio: o operador fala o que
fez ("apliquei a vacina 2 no boi 3"), o áudio entra numa fila que tolera falta
de sinal, e a IA faz uma **pré-análise** — ela não escreve no sistema, ela
**sugere** um conjunto de operações. Quem administra revisa e confirma; só então
as operações são aplicadas.

## Stack

| Camada        | Escolha                                  |
| ------------- | ---------------------------------------- |
| Web           | Next.js 16 (App Router) + React 19 + TS   |
| Estilo        | Tailwind CSS v4 (tokens em `globals.css`) |
| Validação     | Zod 4 (compartilhada cliente/servidor)    |
| Ícones        | lucide-react                              |
| Banco         | Postgres + Drizzle ORM                    |
| Autenticação  | Better Auth (e-mail/senha + organizations) |

## Rodando

Precisa de um Postgres. Uma vez, crie o papel e o banco:

```bash
sudo -u postgres psql -c "CREATE ROLE vocare LOGIN PASSWORD 'vocare';" -c "CREATE DATABASE vocare OWNER vocare;"
```

Depois:

```bash
npm install
cp .env.example .env.local   # e gere o segredo: openssl rand -base64 32
npm run db:migrate           # aplica as tabelas
npm run seed -- "Fazenda Santa Rita" voce@exemplo.com "sua-senha"
npm run dev
```

## Autenticação

E-mail e senha via Better Auth, com o plugin `organization` — cada fazenda ou
clínica é uma organização e os usuários são membros dela. É o multi-tenant que
o produto precisa desde o começo.

A proteção de rota tem duas camadas, como o guia do Next 16 recomenda:

- `src/proxy.ts` (era `middleware.ts` antes do Next 16) faz a checagem
  **otimista**: só olha se o cookie de sessão existe. Roda em toda navegação,
  inclusive prefetch, então nunca consulta o banco.
- `src/lib/auth/dal.ts` faz a checagem **real**, contra o banco, chamada por
  cada página que depende de identidade. É a defesa que vale.

Cadastro público não existe de propósito: operadores e veterinários são criados
por quem administra a organização (por enquanto, via `npm run seed`).

## Estrutura

- `src/app/(auth)/login/` — tela de login
- `src/app/(app)/dashboard/` — área logada (placeholder)
- `src/app/api/auth/[...all]/` — handler do Better Auth
- `src/lib/auth/server.ts` — configuração do Better Auth
- `src/lib/auth/actions.ts` — server actions de login e logout
- `src/lib/auth/dal.ts` — Data Access Layer da sessão
- `src/lib/db/schema.ts` — **gerado** por `npm run auth:generate`, não edite à mão
- `drizzle/` — migrações SQL

## Convenções

- A cor de marca vive só em `src/app/globals.css` (`--color-brand`).
- O nome do produto vive só em `src/lib/brand.ts` (`BRAND_NAME`).
- Mudou a config do Better Auth? Rode `npm run auth:generate` e depois
  `npm run db:generate` para refazer schema e migração.
