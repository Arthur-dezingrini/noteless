# Segurança: autenticação, autorização, proteção de dados e vulnerabilidades

> Avaliação feita em 16/11/2026 sobre a `main` (commit `2a26426`), por leitura
> do código, testes automatizados, `npm audit`, varredura de segredos no
> histórico do git e inspeção dos cabeçalhos HTTP do ambiente publicado.
> Itens corrigidos depois desta data devem ser marcados na seção 6.

## 1. Resumo

| Área | Situação |
| --- | --- |
| Autenticação | **Adequada.** Better Auth, senha com scrypt, sessão em banco, cookie `HttpOnly`/`Secure`, sem cadastro público, gravador com segredo próprio |
| Autorização | **Adequada e testada.** Papel por empresa conferido em toda rota; toda consulta filtrada pela empresa; 179 testes de rota, vários só de "quem não pode" |
| Proteção de dados | **Adequada.** HTTPS ponta a ponta, banco com TLS e criptografia em repouso, segredos fora do git, validação de toda entrada |
| Vulnerabilidades | **2 de prioridade alta** (dependências desatualizadas com alertas críticos; cabeçalhos de segurança ausentes) e itens médios e baixos, todos com correção conhecida — ver seção 5 |

## 2. Autenticação

**Como funciona.** E-mail e senha pelo [Better Auth](https://better-auth.com)
(`apps/api/src/auth.ts`), que vive só na api. O web tem o cliente e lê a
sessão pela api.

| Controle | Como está |
| --- | --- |
| Armazenamento de senha | hash **scrypt** com sal (padrão do Better Auth), na tabela `account`; a senha nunca é gravada nem registrada em log |
| Tamanho da senha | mínimo 8, máximo 128 caracteres |
| Cadastro | **não existe cadastro público** (`disableSignUp`). Usuário é criado por um administrador da empresa, com senha temporária, ou pelo `seed`. Empresa nova só pelo servidor (`allowUserToCreateOrganization: false`) |
| Sessão | token aleatório guardado no banco (`session`), enviado em cookie `HttpOnly`, `Secure` (HTTPS) e `SameSite=Lax`, assinado com `BETTER_AUTH_SECRET`. Vale 30 dias e renova no máximo uma vez por dia |
| Encerramento | sair apaga a sessão no banco; trocar a senha derruba as sessões dos outros aparelhos (testado em `test/conta/usuarios.test.ts`) |
| CSRF | o Better Auth recusa POST de origem fora de `trustedOrigins` (`WEB_URL` + `ORIGENS_EXTRAS`); o cookie é `SameSite=Lax`; o CORS da api só aceita essas origens |
| Força bruta | limitador do Better Auth ligado em produção: 3 tentativas a cada 10 s em `/sign-in`, `/change-password` e `/change-email`; 100 requisições a cada 10 s no resto. Ver ressalva V4 |
| Super usuário | o campo `tipo` tem `input: false`: ninguém se marca super pela api, nem no cadastro nem no próprio perfil. Só outro super usuário (`PATCH /api/admin/usuarios/:id`) ou o script `npm run super` (que exige acesso ao banco) promove |
| Gravador de campo | não tem conta nem senha. Sorteia um segredo de 32 bytes na primeira vez que liga; manda `Authorization: Gravador <série> <segredo>`; o servidor guarda só o SHA-256 e compara em tempo constante (`timingSafeEqual`). Só passa a mandar notas depois que o super usuário digita o código que a própria placa mostra (derivado do segredo). Placas aguardando aprovação têm teto (20) e prazo (7 dias) |
| Duas camadas no web | `proxy.ts` só olha se o cookie existe (otimista, sem custo); `lib/auth/dal.ts` confere de verdade na api e valida a resposta contra o contrato. Página nenhuma confia só no proxy |

## 3. Autorização

### Modelo

- **Empresa (organização)** é a fronteira dos dados. Um usuário pode estar em
  várias; cada vínculo (`member`) tem um papel.
- **Papéis**: `owner` (dono; não pode ser alterado nem removido), `admin`
  (gerencia usuários e dados) e `member` (opera).
- **Super usuário** (`user.tipo = "super"`): administra a plataforma; entra em
  qualquer empresa como dono e aprova gravadores.
- **Gravador aprovado**: só pode **enviar áudio** para a empresa dele. Não lê
  nada.

### Como é aplicado

Toda rota de negócio começa por `membroAtual(headers, orgId)`
(`apps/api/src/base/membro-atual.ts`): sem sessão, ou sem vínculo com a empresa
da URL, a resposta é 403 antes de qualquer leitura. Depois, **toda consulta e
toda escrita filtram por `organization_id`** — saber o id de um animal de outra
empresa não adianta (proteção contra IDOR). Ids são UUID aleatórios.

### Quem pode o quê (resumo)

| Ação | member | admin | owner | super |
| --- | :-: | :-: | :-: | :-: |
| Ver dados da empresa, gravar nota, conferir nota | ✓ | ✓ | ✓ | ✓ |
| Cadastrar e editar animais, grupos, agenda e prontuários | ✓ | ✓ | ✓ | ✓ |
| Remover animal ou grupo, apagar prontuário | | ✓ | ✓ | ✓ |
| Aviário: criar galpão e lote, transferir, lançar apontamento, pesagem e vacinação (membro só vê) | | ✓ | ✓ | ✓ |
| **Salvar ou descartar nota** (aplica no sistema) | | ✓ | ✓ | ✓ |
| Criar usuário, mudar papel, tirar da empresa | | ✓ | ✓ | ✓ |
| Trocar senha/e-mail de outra pessoa | | só de quem está apenas nesta empresa e não é dono nem super | idem | ✓ |
| Ver gravadores da empresa | | ✓ | ✓ | ✓ |
| Vincular qualquer usuário a qualquer empresa, aprovar gravador | | | | ✓ |

A regra de troca de senha impede uma tomada de conta: sem ela, um
administrador poderia vincular o dono de outra fazenda pelo e-mail e trocar a
senha dele.

### Evidência

Os testes de rota (`apps/api/test/`, 179 casos) rodam contra um Postgres em
memória com as migrações reais e o Better Auth de verdade. Exemplos de "quem
não pode":

- `acesso.test.ts`: sem login não entra; gente de outra fazenda não vê nada,
  nem o dono dela; não dá para ligar consulta ao animal de outra fazenda.
- `conta/usuarios.test.ts`: tomada de conta pelo vínculo é barrada;
  administrador não troca senha do dono; membro não troca senha de ninguém;
  ninguém cria organização pela api.
- `conta/gravadores.test.ts`: placa com segredo errado 403; aguardando
  aprovação não manda nota; aprovada não manda para outra empresa e não lê
  notas.
- `conta/super-acesso.test.ts`, `conta/admin.test.ts`: o que só o super faz.

## 4. Proteção de dados

| Controle | Como está |
| --- | --- |
| Em trânsito | HTTPS em tudo (Vercel, com HSTS `max-age=63072000; preload`); api → Neon por WebSocket seguro (TLS, `sslmode=require`); api → Groq/Anthropic por HTTPS; gravador → web por HTTPS |
| Em repouso | Neon criptografa o armazenamento; senhas com scrypt; segredo do gravador só como SHA-256 |
| Segredos | só em variáveis de ambiente (Vercel e `.env` local, ignorado pelo git). `.env.example` sem valores. `segredos.h` do firmware ignorado pelo git. A api valida as variáveis na subida e, no log, mostra só o host do banco, nunca a credencial |
| Entrada | todo corpo JSON é validado com o schema Zod do contrato antes de uso; consultas pelo Drizzle são parametrizadas (sem SQL montado com texto do usuário); avatar só PNG/JPEG/WebP até 2 MB; áudio até 25 MB (a Vercel limita a 4,5 MB) |
| Saída | o React escapa todo texto; não há `dangerouslySetInnerHTML`; a saída da IA é validada pelo contrato antes de virar nota |
| Isolamento entre empresas | pela aplicação (filtro por `organization_id`), coberto por testes. Ver V8 |
| Mínimo de dados | o sistema pede só o necessário; ver [lgpd.md](lgpd.md) |
| Registro | log de requisições da api (método, caminho, status, tempo), sem corpo e sem cabeçalho de autenticação |

## 5. Verificação de vulnerabilidades básicas

### 5.1 O que foi feito

| Verificação | Ferramenta / como | Resultado |
| --- | --- | --- |
| Testes automatizados | `npm test` (Vitest) numa cópia limpa da `main` | 316 testes passando (shared 76, web 61, api 179) |
| Tipos e lint | `npm run typecheck`, `npm run lint` | sem erro |
| Build | `npm run build` | ok |
| Dependências | `npm audit` | 22 alertas (2 críticos, 4 altos, 15 moderados, 1 baixo); ver V1 |
| Segredos no histórico | `git log -p --all` buscando chaves da Groq/Anthropic, URLs de banco com senha e `BETTER_AUTH_SECRET` | 1 achado; ver V5 |
| Arquivos sensíveis versionados | `git log --all --name-only` buscando `.env` e `segredos.h` | só os `.example` |
| Cabeçalhos HTTP | `curl -I` no ambiente publicado | só HSTS; ver V2 |
| Revisão manual | autenticação, autorização, upload, CORS/CSRF, injeção, XSS, IDOR, pela lista OWASP Top 10 (abaixo) | achados V3, V4, V6 a V9 |

### 5.2 OWASP Top 10 (2021)

| Risco | Situação no Noteless |
| --- | --- |
| A01 Quebra de controle de acesso | papel por empresa em toda rota, filtro por empresa em toda consulta, testes de "quem não pode" |
| A02 Falhas criptográficas | HTTPS + HSTS, TLS no banco, scrypt, SHA-256 + comparação em tempo constante |
| A03 Injeção | Drizzle parametrizado; o único `sql.raw` monta nomes de coluna vindos do próprio esquema, não do usuário; React escapa HTML |
| A04 Design inseguro | IA não grava nada sem confirmação humana; gravador sem senha embarcada; tomada de conta por vínculo prevista e barrada |
| A05 Configuração insegura | variáveis validadas na subida; cadastro público desligado; **cabeçalhos de segurança ausentes (V2)** |
| A06 Componentes vulneráveis | **dependências com alertas (V1)** |
| A07 Falhas de identificação e autenticação | Better Auth, limitador de tentativas (**em memória, V4**), sessão revogável; sem MFA e sem recuperação de senha (V6) |
| A08 Integridade de software e dados | `package-lock.json` versionado, `npm ci` no CI, saída da IA validada por schema |
| A09 Falhas de log e monitoramento | log de requisição da api e erros na Vercel; histórico de erros dos gravadores; sem alerta automático |
| A10 SSRF | a api só chama URLs fixas da configuração (Groq, Anthropic, transcrição); nenhuma URL vem do usuário |

### 5.3 Achados

| # | Gravidade | Achado | Recomendação |
| --- | --- | --- | --- |
| V1 | **Alta** | **Dependências com alertas de segurança.** Em produção: `next` 16.3.4 (alertas críticos e altos, entre eles execução remota na otimização de imagem com SVG e SSRF; o `npm audit` indica a 16.4.6), `better-auth` 1.7.5 (alertas críticos em OAuth e magic link — recursos que o Noteless **não usa**), `hono` 4.13.7 e `@hono/node-server` (desvio de middleware em `serveStatic` e `mount`, que não são usados), `zod` 4.6.5 (consumo de memória com coleções enormes). O resto (vite, vitest, esbuild, drizzle-kit, typescript-eslint) é só de desenvolvimento | `npm audit fix` resolve todos sem versão major, exceto o `drizzle-kit` (só desenvolvimento). Rodar `npm test` e `npm run build` depois e publicar |
| V2 | **Alta** | **Cabeçalhos de segurança ausentes no web.** Só há HSTS (posto pela Vercel). Faltam `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` (a tela pode ser embutida em outro site: clickjacking), `X-Content-Type-Options: nosniff` e `Referrer-Policy` | `headers()` no `apps/web/next.config.ts` com esses cabeçalhos para todas as rotas |
| V3 | Média | **Áudio servido com o tipo informado por quem enviou.** `GET …/ocorrencias/:id/audio` devolve o `Content-Type` que veio no upload. Um arquivo com tipo `text/html` seria exibido como página no domínio do web. Mitigado porque o arquivo precisa antes passar pela transcrição (que recusa o que não é áudio) e só membros da empresa enviam | aceitar só `audio/*` no upload; na resposta, `X-Content-Type-Options: nosniff` e `Content-Security-Policy: sandbox` |
| V4 | Média | **Limitador de tentativas de login guardado em memória.** Na Vercel cada instância da função tem o seu contador; um ataque espalhado entre instâncias passa de 3 tentativas a cada 10 s | `rateLimit: { storage: "database" }` no Better Auth (cria a tabela `rate_limit`) ou armazenamento secundário (Redis/Upstash) |
| V5 | Baixa | **Segredo de sessão antigo no histórico do git.** Um valor de `BETTER_AUTH_SECRET` esteve em `apps/api/.env.example` nos commits `a81bc7d` e `574e774` (set/2026). **Não é o segredo usado hoje nos `.env` locais.** O repositório é privado | confirmar que o segredo da Vercel também é outro; se for igual, gerar um novo (`openssl rand -base64 32`) — todos precisarão entrar de novo |
| V6 | Baixa | **Sem verificação de e-mail, sem recuperação de senha e sem MFA.** Esquecer a senha depende de um administrador. A troca do próprio e-mail não pede a senha atual | quando houver envio de e-mail: verificação e recuperação; exigir a senha atual para trocar o e-mail; MFA (plugin `twoFactor`) para administradores |
| V7 | Baixa | **Sessão longa (30 dias).** Escolha consciente (quem está no campo não quer logar toda hora), mas aumenta a janela de uso de um cookie roubado | manter; reduzir para administradores se surgir MFA |
| V8 | Informativa | **Isolamento entre empresas só na aplicação**, sem Row-Level Security no Postgres. Um erro numa consulta nova vazaria dados de outra empresa | manter a regra de teste "outra organização não vê" em toda rota nova; avaliar RLS no futuro |
| V9 | Informativa | **Registro de placa aberto** (`POST /api/gravadores/estado`): qualquer um cria uma placa "aguardando". Sem acesso a dados; mitigado por teto de 20 e prazo de 7 dias | manter |

## 6. Acompanhamento

| # | Status | Data | Commit |
| --- | --- | --- | --- |
| V1 | aberto | | |
| V2 | aberto | | |
| V3 | aberto | | |
| V4 | aberto | | |
| V5 | conferir na Vercel | | |
| V6 | aberto (depende de envio de e-mail) | | |

## 7. Como repetir esta verificação

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build
npm audit
git log -p --all | grep -nE 'gsk_[A-Za-z0-9]{20,}|sk-ant-|BETTER_AUTH_SECRET="?[A-Za-z0-9+/=]{30,}'
curl -sI https://vocare-iota.vercel.app/login
```
