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
| Banco         | Postgres no Neon + Drizzle ORM               |
| Autenticação  | Better Auth (e-mail/senha + organizations)   |
| Contrato      | Zod 4 em `packages/shared`                   |
| Monorepo      | npm workspaces + Turborepo                   |

## Rodando

Precisa de Node 24+. O banco é um Postgres compartilhado no Neon — peça a
`DATABASE_URL` e o `BETTER_AUTH_SECRET` a alguém do time **por mensagem
privada** (nunca no git, nunca no grupo).

```bash
npm install
cp apps/api/.env.example apps/api/.env      # cole DATABASE_URL e BETTER_AUTH_SECRET do time
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate                          # aplica migrações pendentes (idempotente)
npm run dev                                 # sobe web e api juntos
```

O `seed` já foi rodado no banco compartilhado; só rode de novo se estiver
num banco novo: `npm run seed -- "Fazenda Santa Rita" voce@exemplo.com "sua-senha"`.

### Trabalhando em grupo no mesmo banco

- **Mudou o schema?** `npm run db:generate`, commite `apps/api/drizzle/` e
  avise o time. Os outros dão `git pull` + `npm run db:migrate`.
- **Migração destrutiva** (remover coluna, renomear tabela) derruba quem
  está com o código antigo. Teste em homologação primeiro
  (`npm run db:migrate:hom`, `npm run dev:hom`) e só aplique no principal
  quando o código já estiver na `main`.
- Todo mundo usa o **mesmo** `BETTER_AUTH_SECRET`, senão a sessão criada
  pela api de um não é aceita pela api do outro.

### Por que o driver do Neon e não `pg`

A api usa `@neondatabase/serverless`, que fala com o banco por **WebSocket na
porta 443**. A 5432 é bloqueada em muita rede de universidade e empresa — foi o
caso aqui — e com este driver o projeto roda em qualquer lugar sem VPN. O
Drizzle Kit também migra por esse caminho.

O custo: só conecta em Neon (ou outro Postgres atrás de um proxy WebSocket).
Se um dia precisar de Postgres local, troque as quatro linhas de
`apps/api/src/db/index.ts` por `drizzle-orm/node-postgres` + `pg`.

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

### Regras de usuários e organizações

- **Não existe cadastro público** (`disableSignUp`). Todo usuário é criado por
  um administrador da organização, em Configurações → Usuários, com senha
  temporária — e já nasce vinculado àquela organização. O primeiro usuário
  vem do `npm run seed`.
- **Ninguém fica sem organização.** Remover um usuário tira o vínculo com a
  organização, não apaga a conta.
- **Um usuário pode pertencer a várias organizações.** Em Configurações →
  Usuários há dois botões: **Cadastrar usuário** cria uma conta nova (e recusa
  e-mail que já existe); **Vincular usuário** traz para a organização ativa
  alguém que já tem conta por outra clínica/fazenda — só e-mail e papel; nome e
  senha não mudam. A troca entre organizações fica no canto superior esquerdo; a escolha vai para a sessão (`activeOrganizationId`, definida no
  login como a organização mais antiga do usuário) e vale em todas as telas —
  todas leem `getOrgAtiva()` da DAL, nunca "a primeira da lista".
- Papéis por organização: `owner` (quem criou; não muda nem sai), `admin`
  (gerencia usuários e dados) e `member` (opera). O campo `cargo` do usuário
  (Veterinária, Recepcionista, Peão…) é livre.

A api expõe isso em `/api/org/:orgId/usuarios` (listar, criar, editar, remover)
e `/api/org/:orgId/usuarios/vincular`, sempre checando o papel de quem chama.

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
| Banco         | Postgres no Neon + Drizzle ORM               |
| Autenticação  | Better Auth (e-mail/senha + organizations)   |
| Contrato      | Zod 4 em `packages/shared`                   |
| Monorepo      | npm workspaces + Turborepo                   |

## Rodando

Precisa de Node 24+. O banco é um Postgres compartilhado no Neon — peça a
`DATABASE_URL` e o `BETTER_AUTH_SECRET` a alguém do time **por mensagem
privada** (nunca no git, nunca no grupo).

```bash
npm install
cp apps/api/.env.example apps/api/.env      # cole DATABASE_URL e BETTER_AUTH_SECRET do time
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate                          # aplica migrações pendentes (idempotente)
npm run dev                                 # sobe web e api juntos
```

O `seed` já foi rodado no banco compartilhado; só rode de novo se estiver
num banco novo: `npm run seed -- "Fazenda Santa Rita" voce@exemplo.com "sua-senha"`.

### Trabalhando em grupo no mesmo banco

- **Mudou o schema?** `npm run db:generate`, commite `apps/api/drizzle/` e
  avise o time. Os outros dão `git pull` + `npm run db:migrate`.
- **Migração destrutiva** (remover coluna, renomear tabela) derruba quem
  está com o código antigo. Teste em homologação primeiro
  (`npm run db:migrate:hom`, `npm run dev:hom`) e só aplique no principal
  quando o código já estiver na `main`.
- Todo mundo usa o **mesmo** `BETTER_AUTH_SECRET`, senão a sessão criada
  pela api de um não é aceita pela api do outro.

### Por que o driver do Neon e não `pg`

A api usa `@neondatabase/serverless`, que fala com o banco por **WebSocket na
porta 443**. A 5432 é bloqueada em muita rede de universidade e empresa — foi o
caso aqui — e com este driver o projeto roda em qualquer lugar sem VPN. O
Drizzle Kit também migra por esse caminho.

O custo: só conecta em Neon (ou outro Postgres atrás de um proxy WebSocket).
Se um dia precisar de Postgres local, troque as quatro linhas de
`apps/api/src/db/index.ts` por `drizzle-orm/node-postgres` + `pg`.

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

Cadastro público **não existe** (`disableSignUp`): quem cria usuários é um
administrador da organização, em Configurações → Usuários, com uma senha
temporária. A api expõe isso em `/api/org/:orgId/usuarios` (listar, criar,
editar, remover), sempre checando o papel de quem chama. Remover tira a pessoa
da organização, não apaga a conta. O primeiro usuário vem do `npm run seed`.

Papéis: `owner` (quem criou a organização; não pode ser alterado nem removido),
`admin` (gerencia usuários e dados) e `member` (opera). O campo `cargo` do
usuário (Veterinária, Recepcionista, Peão…) é livre.

## Ambientes

Dois branches no Neon, dois arquivos em `apps/api/`:

| Comando               | Arquivo    | Banco                                  |
| --------------------- | ---------- | -------------------------------------- |
| `npm run dev`         | `.env`     | branch principal — o que o time usa    |
| `npm run dev:hom`     | `.env.hom` | branch de homologação — pra testar     |

`.env.hom` é uma cópia do `.env` com a `DATABASE_URL` do branch de homologação
(painel do Neon → selecione o branch → Connection Details). Os dois arquivos
são ignorados pelo git.

A escolha é feita por `APP_ENV` (definida pelo script via `cross-env`, funciona
no Windows). A api imprime na subida qual arquivo carregou e o host do banco —
**olhe essa linha antes de mexer em dados**. Se `.env.hom` não existir,
`dev:hom` recusa subir; nunca cai no banco principal por engano.

Migração e seed têm a variante `:hom`: `db:migrate:hom`, `seed:hom`,
`db:studio:hom`.

## Domínio

Tabelas de negócio ficam em `apps/api/src/db/*.ts` (uma por módulo), separadas
do `schema.ts` gerado pelo Better Auth. Novo arquivo? Registre em
`drizzle.config.ts` e em `db/index.ts`, rode `npm run db:generate` e commite a
migração.

- **Animais** — `animal`: cadastro por organização. Qualquer membro cria e
  edita; remover é de administrador.
- **Consultas** — `consulta`: agenda, ligada ao animal (FK) e opcionalmente a
  um veterinário (usuário da organização; se ele sair, a consulta fica sem
  responsável em vez de sumir). Data e hora separadas, "de parede", sem fuso.
  Qualquer membro agenda, edita e exclui. Status: agendada, confirmada,
  urgente, concluída, cancelada — prefira cancelar a excluir, o histórico fica.
- **Prontuários** — `prontuario`: o registro de um atendimento (queixa, exame
  físico, diagnóstico, remédios receitados, exames pedidos). Normalmente
  documenta uma consulta da agenda — "Registrar atendimento" no menu dela —
  e registrar marca a consulta como concluída. O retorno preenchido vira uma
  consulta nova na agenda. Qualquer membro registra e corrige; apagar é de
  administrador.
- **Ocorrências** — `ocorrencia`: o coração do produto. Um áudio do campo
  entra, é transcrito e interpretado pela IA, e vira um registro *pendente*
  com as operações propostas (JSON). Nada é gravado nas outras tabelas até um
  humano confirmar: a confirmação aplica só as operações marcadas (agendar
  consulta, anotação no animal em `anotacao_animal`, atualizar peso), tudo
  numa transação. Operação sem animal do cadastro não é aplicável — a tela
  avisa. O áudio fica em `ocorrencia_audio` para quem confere poder ouvir.

  O áudio entra por `POST /api/org/:orgId/ocorrencias` (multipart, campo
  `audio`) — é por aí que o gravador de campo (ESP32, em `firmware/`) e o
  WhatsApp vão chegar. Áudio que a transcrição não entende vira ocorrência
  mesmo assim; quem confere escreve o que foi dito (`POST …/:id/texto`) e a IA
  reinterpreta.

  Qualquer membro confere; **salvar ou descartar é do administrador**. O
  membro usa "Mandar para o administrador" (`POST …/:id/encaminhar`).

  A IA precisa de uma chave no `.env` da api (veja `.env.example`). Com só
  `GROQ_API_KEY` (plano grátis em console.groq.com) a transcrição (Whisper)
  e a interpretação (`openai/gpt-oss-120b`, com tool calling) rodam na Groq.
  Se houver `ANTHROPIC_API_KEY`, a interpretação passa para o Claude; a
  resolução está em `apps/api/src/ia/provedor.ts`. A saída do modelo é sempre
  validada pelo contrato antes de virar ocorrência. Sem chave nenhuma a api
  sobe normalmente e a gravação responde 503 dizendo o que falta.

Cada módulo tem contrato em `packages/shared` (schemas Zod), rotas em
`apps/api/src/routes` e leitura no web via `apps/web/src/lib/auth/dal.ts`.

## Comandos (raiz)

| Comando                  | Faz                                              |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | web + api contra o banco principal (Turborepo)   |
| `npm run dev:hom`        | idem, contra o branch de homologação             |
| `npm run build`          | build dos dois                                   |
| `npm run typecheck`      | `tsc` em todos os workspaces                     |
| `npm run lint`           | eslint no web                                    |
| `npm run db:migrate`     | aplica migrações no principal (`:hom` p/ homolog.)|
| `npm run db:generate`    | gera migração a partir do schema                 |
| `npm run auth:generate`  | regenera `schema.ts` a partir da config do auth  |
| `npm run seed -- …`      | cria organização + primeiro usuário (`seed:hom`) |

## Convenções

- O web nunca importa de `apps/api`, e vice-versa. Compartilhado vai para
  `packages/shared`.
- `apps/api/src/db/schema.ts` é **gerado** — não edite à mão. Mudou a config do
  Better Auth? `npm run auth:generate` e depois `npm run db:generate`.
- A cor de marca vive só em `apps/web/src/app/globals.css` (`--color-brand`).
- O nome do produto vive só em `apps/web/src/lib/brand.ts` (`BRAND_NAME`).
