# Backup, alerta de falha e LGPD mínimo — design

**Data:** 2026-11-16

**Pedido:**
- "do p0 eu tenho o ambiente de produção ja app.noteless.com.br";
- "backup eu não tenho, alerta de falha não tenho, LGPD minimo não sei se tenho";
- "voce pode me ajudar a incorporar isso".

**Decisões do Arthur:**
- A cópia do banco vai para o **Cloudflare R2**.
- O alerta chega por **e-mail**.
- Política de Privacidade e Termos de Uso: **rascunho** escrito a partir do que o sistema faz. Um advogado revisa antes de entrar em vigor.
- O áudio das notas fica guardado **90 dias** depois de a nota ser confirmada ou descartada.
- Uma spec só, em três partes entregues e commitadas nesta ordem: backup → alerta → LGPD.

## Objetivo

A produção (`app.noteless.com.br`: web e api na Vercel, banco no Neon) passa a ter:
- uma cópia do banco fora do provedor, com a restauração testada;
- um e-mail quando algo quebra;
- o mínimo de LGPD: textos públicos, aceite registrado e prazo para apagar a voz.

## Contexto encontrado

- `GET /health` responde `{ ok: true }` sem tocar no banco. O web repassa `/health` e `/api/*` para a api (`apps/web/next.config.ts`).
- Falhas da transcrição e da IA só vão para o `console.error` em `notas/rotas.ts`. Isso vale em três pontos: ao guardar o áudio, no pipeline de áudio e na interpretação de texto. Não existe `app.onError`.
- O projeto não envia e-mail. O login avisa que só o administrador redefine senha.
- Não há nada de privacidade, termos ou consentimento, nem no web nem na api.
- A nota tem `revisadoEm`. O campo é preenchido ao confirmar (`regras/aplicar.ts`) e ao descartar, e volta a nulo ao restaurar. O áudio fica no Postgres, em `ocorrencia_audio.dados`.
- No proxy do web, toda rota que não está em `ROTAS_PROTEGIDAS` é pública.
- O README diz que o Postgres do Neon é compartilhado. Uma migration rodada daqui pode cair em produção.
- Commit direto na main, e o push na main publica na Vercel.

## Fora do escopo

- Contrato de tratamento de dados (DPA) separado dos termos.
- Exportar ou apagar a conta pela própria pessoa. Por enquanto isso se pede pelo canal de contato.
- Banner de cookies. Só existe o cookie de sessão, que é necessário.
- Vigia de "o backup não rodou". Uma execução que falha avisa; já o GitHub parar de agendar não avisa.
- Guarda de registros de acesso por 6 meses (Marco Civil, art. 15). Fica como ponto para o advogado avaliar.
- E-mail de convite e "esqueci a senha". Vão usar a base de e-mail desta spec, mas ficam para depois.
- Tirar o áudio do Postgres.

## Parte 1 — Backup no R2

Arquivo novo: `.github/workflows/rotina-diaria.yml`. Fica separado do `ci.yml`, que não usa nenhum segredo. Roda às 06:00 UTC (03:00 de Brasília) e também à mão, pelo `workflow_dispatch`. O disparo à mão tem a opção `simular_falha`, que serve para conferir o e-mail de falha.

**Job `copia`:**
1. Lê a versão do servidor com `show server_version_num`, rodando o `psql` da imagem `postgres:18`. O `pg_dump` roda na imagem `postgres:<major>` dessa versão, para cliente e servidor ficarem iguais.
2. Roda `pg_dump --format=custom --no-owner --no-privileges` em `BACKUP_DATABASE_URL`. Essa é a conexão direta do Neon, sem `-pooler`.
3. Criptografa com `gpg --symmetric --cipher-algo AES256`, usando `BACKUP_SENHA`.
4. Sobe o arquivo para `s3://$R2_BUCKET/diario/noteless-AAAA-MM-DD.dump.gpg`, com `aws s3 cp --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com`.
5. No dia 1 do mês, gera uma segunda cópia com `--exclude-table-data=ocorrencia_audio` em `mensal/noteless-AAAA-MM.dump.gpg`. Assim o áudio não fica guardado em backup por 12 meses.

**Job `restauracao`**, que roda depois de `copia`:
1. Baixa a cópia diária do dia e descriptografa.
2. Sobe um `postgres:<major>` descartável no próprio runner.
3. Roda `pg_restore --no-owner --no-privileges --exit-on-error`.
4. Confere o `count(*)` de `"user"`, `organization`, `ocorrencia` e `lote`, e as contagens aparecem no log.

A restauração reprova se der qualquer erro ou se `"user"` vier vazio. Se aparecer algum objeto que só existe no Neon e que o Postgres comum não tem, ele sai da restauração de teste por lista (`pg_restore -l` e `-L`). Esse objeto fica nomeado no arquivo.

**Falha:** um passo `if: failure()` manda e-mail para `ALERTA_EMAILS` pela api da Resend (`curl`), com o link da execução. O GitHub também manda o e-mail padrão de workflow falho.

**Validade, configurada pelo Arthur no R2:** o que está em `diario/` é apagado depois de 30 dias, e o que está em `mensal/` depois de 365.

**Como restaurar:** fica num comentário no topo do arquivo.
1. Baixar o `.gpg` e abrir com `gpg --decrypt`.
2. Criar um branch ou um banco novo no Neon.
3. Rodar `pg_restore --no-owner --no-privileges -d <url>`.
4. Só trocar o `DATABASE_URL` na Vercel depois de conferir os dados.

**Neon:** a janela de restauração do plano fica no máximo. Ela continua sendo a primeira linha de defesa, para erro de poucos minutos atrás. A cópia no R2 cobre o resto.

## Parte 2 — Alerta por e-mail

**`apps/api/src/base/email.ts`:**
- `enviarEmail({ para, assunto, texto })` faz `POST https://api.resend.com/emails` com `fetch`, sem biblioteca nova, e tem timeout de 5 s.
- Sem `RESEND_API_KEY`, não envia nada e devolve `{ enviado: false }`. É o caso do dev e dos testes.
- Nunca lança erro.

**`apps/api/src/base/alerta.ts`** — `alertar(tipo, { mensagem, rota?, orgId? })`:
- Manda para `ALERTA_EMAILS`, que é uma lista separada por vírgula. O assunto é `[Noteless <APP_ENV>] <tipo>`.
- O corpo tem a hora de Brasília, a rota, o id da empresa e a mensagem do erro, cortada em 500 caracteres. Nunca leva transcrição, resumo nem áudio.
- O mesmo `tipo` sai no máximo uma vez a cada 15 min por instância. O controle fica em memória, então numa queda com várias instâncias pode chegar mais de um e-mail. A regra do limite é uma função pura com relógio injetável.
- Quem chama espera o envio terminar (`await`), porque na Vercel a função pode congelar depois que responde.

**Onde dispara:**

| Tipo | Lugar |
|---|---|
| `erro-api` | `app.onError` novo. Chama o alerta e responde `500 { error: "Erro interno." }`. Uma `HTTPException` continua com a resposta dela. |
| `pipeline-audio` | `catch` do pipeline de áudio em `notas/rotas.ts`. |
| `interpretar-texto` | `catch` da interpretação de texto em `notas/rotas.ts`. |
| `guardar-audio` | `catch` ao gravar `ocorrencia_audio`. |
| `teste` | `POST /api/admin/alerta-teste`, só para super usuário, para conferir o envio em produção. Responde `{ enviado }`. |

O que o gravador e a tela recebem hoje não muda.

**`/health`:**
- Passa a rodar `select 1` no banco.
- Com o banco ok, responde `200 { ok: true, banco: "ok" }`. Se a consulta falhar, responde `503 { ok: false, banco: "falhou" }`.
- Sempre manda `Cache-Control: no-store`.
- Não dispara alerta. Quem avisa nesse caso é o vigia.

**Vigia externo, criado pelo Arthur:** UptimeRobot ou Better Stack, no plano grátis. Ele consulta `https://app.noteless.com.br/health` a cada 5 min e avisa por e-mail. Cobre web, api e banco de uma vez.

**Variáveis novas na api** (`env.ts`), todas opcionais:
- `RESEND_API_KEY`;
- `EMAIL_REMETENTE`, com padrão `Noteless <onboarding@resend.dev>`. Esse remetente só entrega para o dono da conta Resend até o domínio ser verificado;
- `ALERTA_EMAILS`.

## Parte 3 — LGPD mínimo

**Páginas públicas** em `apps/web/src/app/(publico)/`:
- São três: `/privacidade`, `/termos` e `/aviso-gravador`.
- As páginas são finas. Os textos ficam em `modulos/conta/componentes/`, um arquivo por texto.
- `/aviso-gravador` tem estilo de impressão, cabe em uma folha A4 e tem link a partir de Configurações › Gravadores.

**Constantes em `packages/shared/src/conta/`:**
- `VERSAO_TERMOS = "2026-11-16"`. É a data da versão: mudou o texto, muda a versão, e todos aceitam de novo.
- `DIAS_AUDIO = 90`.
- `TERMOS_EM_VIGOR = false`. Fica assim até o advogado revisar. Com `false`, as páginas mostram a faixa "Rascunho em revisão", o login e o perfil não mostram os links e ninguém é levado ao aceite. Assim a Parte 3 pode ir para produção sem esperar a revisão. Depois da revisão, o Arthur preenche os espaços em branco, troca `VERSAO_TERMOS` pela data da publicação e põe `true`.

**Aceite:**
- Tabela `aceite_termos` em `db/tabelas/conta.ts`, com `id`, `userId` (cascade), `versao`, `aceitoEm` (padrão: agora) e `ip?`. Só um registro por `(userId, versao)`.
- `GET /api/perfil/termos` responde `{ versao, aceitoEm }`. O `aceitoEm` vem nulo se a pessoa ainda não aceitou a versão atual. Sem sessão, 401.
- `POST /api/perfil/termos` recebe `{ versao }`. Versão diferente da atual dá 400. Aceitar de novo mantém o primeiro registro. O IP é o primeiro valor de `x-forwarded-for`.
- No web, o layout de `(app)` pergunta pelo aceite em `modulos/conta/dados.ts`. Se estiver em vigor e a pessoa não tiver aceitado, vai para `redirect("/aceite")`.
- A tela `/aceite` fica fora de `(app)` para não cair em laço. Ela exige sessão, entra em `ROTAS_PROTEGIDAS` e mostra um resumo, os links e "Li e aceito os Termos de Uso e a Política de Privacidade".
- O gravador e as chamadas à api não passam pelo aceite.

**Áudio em 90 dias:**
- Coluna nova `ocorrencia.audioApagadoEm` (timestamp, nulo). A api devolve esse campo junto com a nota.
- Regra `apagarAudiosVencidos(agora)` em `modulos/notas/regras/`, numa transação. Ela apaga o `ocorrencia_audio` das notas `confirmada` ou `descartada` com `revisadoEm` anterior a `agora − DIAS_AUDIO`, marca `audioApagadoEm` e devolve quantas apagou.
  - São no máximo 1000 por chamada.
  - Nota pendente e nota restaurada (status pendente, `revisadoEm` nulo) ficam como estão.
  - Vale para todas as empresas.
- Rota `POST /api/rotinas/limpeza-audio`, com `Authorization: Bearer <ROTINAS_SEGREDO>`.
  - Sem a variável configurada, responde 503.
  - Sem segredo ou com segredo errado, responde 401.
  - Com o segredo certo, responde `200 { apagados }`.
- Job `limpeza-audio` em `rotina-diaria.yml`, depois de `copia`. Ele chama `$APP_URL/api/rotinas/limpeza-audio`, passando pelo repasse `/api/*` do web.
- Na tela, a nota com `audioApagadoEm` mostra "Áudio apagado em DD/MM/AAAA — guardado por 90 dias depois da revisão" no lugar do player.

**Textos.** O rascunho tem espaços para preencher: `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]`, `[E-MAIL DE CONTATO]`, `[CIDADE/UF]` e, no aviso, `[NOME DA EMPRESA]`.

*Privacidade:*
- **Quem é o controlador:** o Noteless, para os dados de conta. Para os dados da fazenda e a voz dos funcionários, o controlador é a empresa cliente e o Noteless é o operador.
- **Dados tratados:**
  - conta;
  - empresa e vínculos;
  - voz e transcrição;
  - registros de produção e de saúde animal;
  - estado do gravador;
  - registros de acesso.
- **Finalidades e bases legais.**
- **Compartilhamento:** Vercel, Neon, OpenAI, Groq, Anthropic, Cloudflare e Resend, com transferência para fora do país.
- **Prazos:**
  - áudio: 90 dias;
  - backup diário: 30 dias;
  - backup mensal, sem áudio: 12 meses.
- **Direitos do art. 18 e o canal para pedir.**
- **Segurança.**
- **Cookies:** só o de sessão.
- **Mudança de versão.**

*Termos:*
- **O serviço.**
- **Contas e papéis.**
- **Notas:** a IA sugere e uma pessoa aprova. O registro aprovado é responsabilidade da empresa.
- **Gravador:** a empresa informa quem usa o gravador e tem base legal para isso.
- **Uso aceitável.**
- **Dados:** os dados da empresa são da empresa.
- **Disponibilidade e backups.**
- **Limitação de responsabilidade.**
- **Mudanças nos termos.**
- **Foro.**

*Aviso do gravador:* linguagem simples, numa folha. Diz o que é gravado e quando, para quê, quem ouve, por quanto tempo fica guardado e a quem pedir.

## Configuração (feita pelo Arthur)

**Parte 1:**
- **R2:**
  - criar o bucket;
  - configurar a validade de `diario/` (30 dias) e de `mensal/` (365 dias);
  - criar um token "Object Read & Write" que vale só para esse bucket.
- **Resend:** criar a conta e verificar o domínio `noteless.com.br` (registros de DNS) para mandar como `avisos@noteless.com.br`.
- **GitHub:**
  - segredos: `BACKUP_DATABASE_URL`, `BACKUP_SENHA`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `RESEND_API_KEY`, `ALERTA_EMAILS`;
  - variável: `EMAIL_REMETENTE`.
- **Cofre de senhas:** guardar a `BACKUP_SENHA` nele. Sem ela, nenhuma cópia abre.
- **Neon:** deixar a janela de restauração no máximo.

**Parte 2:**
- Na Vercel, no projeto da api: `RESEND_API_KEY`, `ALERTA_EMAILS` e `EMAIL_REMETENTE`.
- Criar o vigia externo apontando para `https://app.noteless.com.br/health`.

**Parte 3:**
- `ROTINAS_SEGREDO` na Vercel (api) e nos segredos do GitHub.
- Variável `APP_URL=https://app.noteless.com.br` no GitHub.
- Revisão dos textos pelo advogado, depois o preenchimento dos espaços e por fim `TERMOS_EM_VIGOR = true`.

## Testes

Os testes de rota rodam no PGlite, com `criarFazenda` e `chamar` de `test/ajuda.ts`.

**Parte 1:** o próprio job `restauracao` é o teste. O primeiro disparo é manual, e um segundo com `simular_falha` confere o e-mail de falha.

**Parte 2:**
- `base/alerta.test.ts`:
  - o limite de 15 min, com o mesmo tipo, com tipo diferente e depois do prazo;
  - um envio que falha não lança erro.
- `base/email.test.ts`:
  - sem chave, não chama `fetch`;
  - com chave, manda o remetente, os destinatários e o assunto certos.
- `test/health.test.ts`: responde 200 com o banco no ar e 503 quando a consulta falha.
- `app.onError`: uma rota que lança erro responde 500 em JSON e dispara o alerta `erro-api`.
- `test/notas/`: uma transcrição que lança erro dispara `alertar("pipeline-audio")`, e a resposta continua a de hoje.
- `test/conta/`, sobre `POST /api/admin/alerta-teste`:
  - super usuário: 200;
  - administrador e membro: 403;
  - sem sessão: 401.

**Parte 3:**
- `test/conta/termos.test.ts`:
  - sem sessão, 401;
  - antes de aceitar, `aceitoEm` vem nulo;
  - aceitar a versão atual funciona;
  - versão errada dá 400;
  - aceitar duas vezes mantém o primeiro registro;
  - o aceite de um usuário não vale para outro.
- `test/notas/limpeza-audio.test.ts`, sobre a regra:
  - confirmada há 91 dias: o áudio é apagado e a nota marcada;
  - confirmada há 89 dias: fica;
  - descartada há 91 dias: é apagado;
  - pendente antiga: fica;
  - restaurada: fica;
  - notas de duas empresas.
- `test/notas/limpeza-audio.test.ts`, sobre a rota:
  - sem a variável configurada: 503;
  - sem segredo ou com segredo errado: 401;
  - com o segredo certo: 200.
- `x.test.ts` ao lado do schema de aceite no shared: recusa versão diferente de `VERSAO_TERMOS`.

## Ordem de entrega

1. **Parte 1:** `rotina-diaria.yml`, com os jobs `copia` e `restauracao` e o e-mail de falha.
2. **Parte 2:** `email.ts`, `alerta.ts`, `onError`, `/health` e `alerta-teste`.
3. **Parte 3**, nesta ordem:
   1. as constantes no shared;
   2. a tabela e a coluna, numa migration só;
   3. as rotas de aceite;
   4. a regra e a rota de limpeza de áudio;
   5. no web, as páginas, o aceite e o aviso de áudio apagado;
   6. o job `limpeza-audio`.

Cada parte tem seu próprio commit, com os testes dela.

## Conferência

- `npm run typecheck`, `lint`, `test` e `build` verdes em cada parte.
- **Parte 1:** a execução manual fica verde, o `.gpg` aparece no R2 e as contagens saem no log. Com `simular_falha`, chega o e-mail.
- **Parte 2:** em produção, `POST /api/admin/alerta-teste` chega no e-mail, `/health` responde 200 e o vigia mostra o sistema no ar.
- **Parte 3:**
  - `drizzle-kit generate` produz uma migration só, com `aceite_termos` e `audioApagadoEm`. Ela roda no banco de verdade só com autorização do Arthur, na hora.
  - As três páginas abrem sem login.
  - Com `TERMOS_EM_VIGOR = true` rodando local, o login leva ao aceite e, depois, ao painel.
  - O job `limpeza-audio` fica verde.
