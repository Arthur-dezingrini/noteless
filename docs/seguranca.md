# Segurança: autenticação, autorização, proteção de dados e vulnerabilidades

> Avaliação feita em 16/11/2026 sobre a `main` (commit `2a26426`), por leitura
> do código, testes automatizados, `npm audit`, varredura de segredos no
> histórico do git e inspeção dos cabeçalhos HTTP do ambiente publicado.
> Os achados V1 a V4 foram corrigidos no mesmo dia (seção 6); os números da
> seção 5.1 são da versão corrigida (commit `e0fb021`), com os de antes ao
> lado. Itens corrigidos depois devem ser marcados na seção 6.

## 1. Resumo

| Área | Situação |
| --- | --- |
| Autenticação | **Adequada.** Better Auth, senha com scrypt, sessão em banco, cookie `HttpOnly`/`Secure`, sem cadastro público, gravador com segredo próprio |
| Autorização | **Adequada e testada.** Papel por empresa conferido em toda rota; toda consulta filtrada pela empresa; 254 testes na api, vários só de "quem não pode" |
| Proteção de dados | **Adequada.** HTTPS ponta a ponta, banco com TLS e criptografia em repouso, segredos fora do git, validação de toda entrada |
| Vulnerabilidades | Os **2 de prioridade alta** (dependências com alertas críticos; cabeçalhos de segurança ausentes) e os **2 médios** (tipo do áudio; limite de tentativas de login) foram **corrigidos** com teste. Restam itens baixos e informativos — ver seção 5 |

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
| Recuperação de senha | "esqueci a senha" por e-mail desde 19/11/2026: link de uso único, válido por 1 hora; a resposta é a mesma exista a conta ou não; o destino do link precisa ser uma origem confiável; trocar a senha derruba as sessões e zera a trava de tentativas (testado em `test/conta/redefinir-senha.test.ts`, com a checagem de origem do Better Auth ligada também nos testes) |
| CSRF | o Better Auth recusa POST de origem fora de `trustedOrigins` (`WEB_URL` + `ORIGENS_EXTRAS`); o cookie é `SameSite=Lax`; o CORS da api só aceita essas origens |
| Força bruta | **dez senhas erradas para o mesmo e-mail em 15 minutos travam a entrada desse e-mail até fecharem os 15 minutos** (contados do primeiro erro), mesmo com a senha certa; a resposta é a mesma exista a conta ou não; o contador fica no banco, então vale igual para todas as instâncias da Vercel, e zera quando a pessoa entra (`apps/api/src/modulos/conta/regras/tentativas-login.ts`). A tela mostra quanto falta. Por cima disso, o limitador do Better Auth: 3 tentativas a cada 10 s em `/sign-in`, `/change-password` e `/change-email` e 100 requisições a cada 10 s no resto, por IP e em memória (cada instância conta a sua parte). Ver V4 e V10 |
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

Os testes da api (`apps/api/test/`, 254 casos) rodam contra um Postgres em
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
- `conta/tentativas-login.test.ts`: a décima senha errada trava o e-mail
  (com qualquer maiúscula ou espaço), outra pessoa continua entrando, erros
  simultâneos contam todos, a trava acaba em 15 minutos.

## 4. Proteção de dados

| Controle | Como está |
| --- | --- |
| Em trânsito | HTTPS em tudo (Vercel, com HSTS `max-age=63072000; preload`); api → Neon por WebSocket seguro (TLS, `sslmode=require`); api → Groq/Anthropic por HTTPS; gravador → web por HTTPS |
| Em repouso | Neon criptografa o armazenamento; senhas com scrypt; segredo do gravador só como SHA-256 |
| Segredos | só em variáveis de ambiente (Vercel e `.env` local, ignorado pelo git). `.env.example` sem valores. `segredos.h` do firmware ignorado pelo git. A api valida as variáveis na subida e, no log, mostra só o host do banco, nunca a credencial |
| Entrada | todo corpo JSON é validado com o schema Zod do contrato antes de uso; consultas pelo Drizzle são parametrizadas (sem SQL montado com texto do usuário); avatar só PNG/JPEG/WebP até 2 MB; áudio só `audio/*` (outro tipo é recusado com 415) e até 25 MB (a Vercel limita a 4,5 MB) |
| Saída | o React escapa todo texto; não há `dangerouslySetInnerHTML`; a saída da IA é validada pelo contrato antes de virar nota; o áudio só sai com tipo de áudio, `nosniff` e `Content-Security-Policy: sandbox` |
| Cabeçalhos | em toda resposta do web (`apps/web/next.config.ts`): `Content-Security-Policy` (tudo do próprio site, `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` (microfone só no próprio site; câmera e localização, ninguém); o HSTS a Vercel põe |
| Isolamento entre empresas | pela aplicação (filtro por `organization_id`), coberto por testes. Ver V8 |
| Mínimo de dados | o sistema pede só o necessário; ver [lgpd.md](lgpd.md) |
| Registro | log de requisições da api (método, caminho, status, tempo), sem corpo e sem cabeçalho de autenticação |
| Cópias de segurança | cópia diária do banco criptografada (GPG) antes de sair do GitHub Actions para o Cloudflare R2; a restauração é testada todo dia; a cópia mensal vai sem o áudio |
| Firmware | a placa só instala versão com SHA-256 e assinatura ECDSA P-256 válidas (chave pública embutida no firmware); a chave privada fica só na api |

## 5. Verificação de vulnerabilidades básicas

### 5.1 O que foi feito

| Verificação | Ferramenta / como | Resultado |
| --- | --- | --- |
| Testes automatizados | `npm test` (Vitest) numa cópia limpa da `main` | em 16/11: 331 testes passando (shared 76, web 65, api 190); antes das correções, 316. Em 19/11/2026: **410 passando** (shared 85, web 71, api 254) |
| Tipos e lint | `npm run typecheck`, `npm run lint` | sem erro |
| Build | `npm run build` | ok |
| Dependências | `npm audit` | antes: 22 alertas (2 críticos, 4 altos, 15 moderados, 1 baixo). Depois de V1: **5 moderados**, nenhum alcançável em produção (ver V1). Repetido em 19/11/2026: os mesmos 5 moderados, nenhum alto ou crítico |
| Segredos no histórico | `git log -p --all` buscando chaves da Groq/Anthropic, URLs de banco com senha e `BETTER_AUTH_SECRET` | 1 achado; ver V5 |
| Arquivos sensíveis versionados | `git log --all --name-only` buscando `.env` e `segredos.h` | só os `.example` |
| Cabeçalhos HTTP | `curl -I` no ambiente publicado; teste automatizado em `apps/web/next.config.test.ts` | antes: só HSTS. Depois de V2: os cinco cabeçalhos em toda rota, conferidos no teste e no navegador (nenhuma violação de CSP, página hidrata) |
| Revisão manual | autenticação, autorização, upload, CORS/CSRF, injeção, XSS, IDOR, pela lista OWASP Top 10 (abaixo) | achados V3, V4, V6 a V9 |

### 5.2 OWASP Top 10 (2021)

| Risco | Situação no Noteless |
| --- | --- |
| A01 Quebra de controle de acesso | papel por empresa em toda rota, filtro por empresa em toda consulta, testes de "quem não pode" |
| A02 Falhas criptográficas | HTTPS + HSTS, TLS no banco, scrypt, SHA-256 + comparação em tempo constante |
| A03 Injeção | Drizzle parametrizado; o único `sql.raw` monta nomes de coluna vindos do próprio esquema, não do usuário; React escapa HTML |
| A04 Design inseguro | IA não grava nada sem confirmação humana; gravador sem senha embarcada; tomada de conta por vínculo prevista e barrada |
| A05 Configuração insegura | variáveis validadas na subida; cadastro público desligado; cabeçalhos de segurança em toda resposta (V2, corrigido) |
| A06 Componentes vulneráveis | dependências atualizadas (V1, corrigido); restam 5 alertas moderados em ferramenta de desenvolvimento e em recurso não usado |
| A07 Falhas de identificação e autenticação | Better Auth, trava de dez erros por e-mail guardada no banco (V4, corrigido), sessão revogável; recuperação de senha por e-mail; sem MFA (V6) |
| A08 Integridade de software e dados | `package-lock.json` versionado, `npm ci` no CI, saída da IA validada por schema; firmware do gravador assinado (ECDSA P-256) e conferido pela placa antes de instalar, com volta automática para a versão anterior |
| A09 Falhas de log e monitoramento | log de requisição da api e erros na Vercel; histórico de erros dos gravadores; alerta por e-mail (Resend) para erro não tratado na api, falha da IA nas notas e falha da rotina diária; `/health` confere o banco |
| A10 SSRF | a api só chama URLs fixas da configuração (Groq, Anthropic, transcrição); nenhuma URL vem do usuário |

### 5.3 Achados

| # | Gravidade | Achado | Recomendação ou correção |
| --- | --- | --- | --- |
| V1 | **Alta** | **Dependências com alertas de segurança.** Em produção: `next` 16.3.4 (alertas críticos e altos, entre eles execução remota na otimização de imagem com SVG e SSRF; o `npm audit` indica a 16.4.6), `better-auth` 1.7.5 (alertas críticos em OAuth e magic link — recursos que o Noteless **não usa**), `hono` 4.13.7 e `@hono/node-server` (desvio de middleware em `serveStatic` e `mount`, que não são usados), `zod` 4.6.5 (consumo de memória com coleções enormes). O resto (vite, vitest, esbuild, drizzle-kit, typescript-eslint) é só de desenvolvimento | **Corrigido (`c8130f1`):** `next` 16.4.6, `better-auth` 1.7.15, `hono` 4.13.19, `zod` 4.6.7 e o resto pelo `npm audit fix`; testes, lint, tipos e build verdes. Restam 5 moderados: `esbuild` antigo dentro do `drizzle-kit` (só desenvolvimento; a correção exige versão major) e `serveStatic` do `@hono/node-server` (não usado; correção só na 2.x) |
| V2 | **Alta** | **Cabeçalhos de segurança ausentes no web.** Só há HSTS (posto pela Vercel). Faltam `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors` (a tela pode ser embutida em outro site: clickjacking), `X-Content-Type-Options: nosniff` e `Referrer-Policy` | **Corrigido (`cca74da`):** `headers()` no `apps/web/next.config.ts` com CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e `Permissions-Policy` em toda rota, com teste. A CSP ainda permite script inline, porque o Next hidrata a página com script inline; trocar por *nonce* fica para depois |
| V3 | Média | **Áudio servido com o tipo informado por quem enviou.** `GET …/ocorrencias/:id/audio` devolve o `Content-Type` que veio no upload. Um arquivo com tipo `text/html` seria exibido como página no domínio do web. Mitigado porque o arquivo precisa antes passar pela transcrição (que recusa o que não é áudio) e só membros da empresa enviam | **Corrigido (`bce4628`):** o upload só aceita `audio/*` (outro tipo recebe 415 antes de gastar a IA); a resposta só devolve tipo de áudio (arquivo antigo com outro tipo sai como `application/octet-stream`), com `nosniff` e `Content-Security-Policy: sandbox`. Testado |
| V4 | Média | **Limitador de tentativas de login guardado em memória.** Na Vercel cada instância da função tem o seu contador; um ataque espalhado entre instâncias passa de 3 tentativas a cada 10 s | **Corrigido (`e0fb021`):** dez senhas erradas para o mesmo e-mail em 15 minutos travam esse e-mail até o fim dessa janela, mesmo com a senha certa. O contador fica no banco (tabela `verification`, gravação atômica), igual para todas as instâncias, sem migração nova; zera ao entrar. A tela mostra quanto falta (HTTP 429). Testado |
| V5 | Baixa | **Segredo de sessão antigo no histórico do git.** Um valor de `BETTER_AUTH_SECRET` esteve em `apps/api/.env.example` nos commits `a81bc7d` e `574e774` (set/2026). **Não é o segredo usado hoje nos `.env` locais.** O repositório é privado | confirmar que o segredo da Vercel também é outro; se for igual, gerar um novo (`openssl rand -base64 32`) — todos precisarão entrar de novo |
| V6 | Baixa | **Sem verificação de e-mail, sem recuperação de senha e sem MFA.** Esquecer a senha dependia de um administrador. A troca do próprio e-mail não pede a senha atual | **Recuperação de senha por e-mail feita (19/11/2026).** Faltam: verificação de e-mail; exigir a senha atual para trocar o e-mail; MFA (plugin `twoFactor`) para administradores |
| V7 | Baixa | **Sessão longa (30 dias).** Escolha consciente (quem está no campo não quer logar toda hora), mas aumenta a janela de uso de um cookie roubado | manter; reduzir para administradores se surgir MFA |
| V8 | Informativa | **Isolamento entre empresas só na aplicação**, sem Row-Level Security no Postgres. Um erro numa consulta nova vazaria dados de outra empresa | manter a regra de teste "outra organização não vê" em toda rota nova; avaliar RLS no futuro |
| V9 | Informativa | **Registro de placa aberto** (`POST /api/gravadores/estado`): qualquer um cria uma placa "aguardando". Sem acesso a dados; mitigado por teto de 20 e prazo de 7 dias | manter |
| V10 | Informativa | **A trava de login pode ser acionada por outra pessoa** (efeito da correção de V4): quem souber o e-mail de alguém pode errar a senha dez vezes e impedir essa pessoa de entrar por até 15 minutos | aceitável: é melhor que deixar adivinhar a senha, e a trava acaba sozinha. Se virar problema: desbloqueio pelo administrador ou CAPTCHA depois de alguns erros |

## 6. Acompanhamento

| # | Status | Data | Commit |
| --- | --- | --- | --- |
| V1 | corrigido | 16/11/2026 | `c8130f1` |
| V2 | corrigido | 16/11/2026 | `cca74da` |
| V3 | corrigido | 16/11/2026 | `bce4628` |
| V4 | corrigido | 16/11/2026 | `e0fb021` |
| V5 | conferir na Vercel | | |
| V6 | em parte: recuperação de senha feita; faltam verificação de e-mail e MFA | 19/11/2026 | |
| V10 | aceito (ver 5.3) | 16/11/2026 | |

As correções entram no ar com o deploy da `main`. Cada commit passou por
`npm run typecheck` e `npm test` sozinho; o último, também por lint e build.

**Revisão de 19/11/2026.** `npm audit` repetido (os mesmos 5 moderados,
nenhum alto ou crítico); 410 testes passando; os seis cabeçalhos conferidos
com `curl -I` em https://app.noteless.com.br; nenhum segredo nos commits
posteriores a 16/11 (mesma busca de 5.1). Mudanças posteriores a 16/11 que
mexem com segurança, conferidas pelos testes: a atualização do firmware pelo
ar — só o super usuário publica, a placa só baixa a versão-alvo dela, com o
próprio segredo, e confere SHA-256 e assinatura antes de instalar
(`apps/api/test/conta/firmware.test.ts`) — e os alertas por e-mail (A09).

## 7. Como repetir esta verificação

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build
npm audit
git log -p --all | grep -nE 'gsk_[A-Za-z0-9]{20,}|sk-ant-|BETTER_AUTH_SECRET="?[A-Za-z0-9+/=]{30,}'
curl -sI https://vocare-iota.vercel.app/login
```
