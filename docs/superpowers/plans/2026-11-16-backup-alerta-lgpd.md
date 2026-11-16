# Backup, alerta de falha e LGPD mínimo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** dar à produção três coisas: uma cópia diária do banco no R2 com a restauração testada, um e-mail quando algo quebra e o mínimo de LGPD (textos, aceite e áudio apagado em 90 dias).

**Arquitetura:**
- Uma rotina do GitHub Actions copia, testa a restauração e dispara a limpeza do áudio.
- A api ganha `base/email.ts` e `base/alerta.ts`, ligados ao `app.onError` e aos `catch` das notas. O `/health` passa a testar o banco.
- A LGPD entra assim:
  - constantes no shared;
  - tabela `aceite_termos` e coluna `audioApagadoEm`, numa migration só;
  - rotas de aceite e de rotina;
  - páginas públicas e uma porta de aceite no layout do web, desligada até o advogado revisar.

**Stack:** Hono, Drizzle e Postgres (Neon; PGlite nos testes), Next 16, Zod 4, Vitest, GitHub Actions, Cloudflare R2 (via aws-cli), Resend (via `fetch`).

**Spec:** `docs/superpowers/specs/2026-11-16-backup-alerta-lgpd-design.md`

## Restrições globais

- Sem biblioteca nova. O e-mail sai pela api HTTP da Resend, com `fetch`.
- O e-mail de alerta nunca leva transcrição, resumo nem áudio. A mensagem de erro é cortada em 500 caracteres.
- O mesmo `tipo` de alerta sai no máximo uma vez a cada 15 min por instância.
- Valores fixos:
  - `DIAS_AUDIO = 90`;
  - `VERSAO_TERMOS = "2026-11-16"`;
  - `TERMOS_EM_VIGOR = false`.
- Backup às 06:00 UTC. As cópias ficam assim:
  - `diario/` guarda 30 dias;
  - `mensal/` guarda 365 dias, sem os dados de `ocorrencia_audio`.
- Nenhuma migration roda no banco de verdade sem a autorização do Arthur na hora. Nada de push.
- Na tela o texto diz "nota". No código, no banco e na api continua `ocorrencia`.
- Teste no mesmo commit da funcionalidade, e `npm test` verde antes de commitar.
- Commit direto na main, sem branch.
- Fora do módulo, entra-se só pelo `index.ts`. No web vale também o `dados`, mas nunca a partir de `"use client"`.
- Identificadores e textos em português. Arquivo acima de ~300 linhas se divide.
- Nenhuma variável nova pode derrubar a api na subida. As novas são todas opcionais e sem validação de formato que chame `process.exit`.

## Pontos de revisão

1. **Nota sem áudio** (criada por texto) e confirmada há mais de 90 dias não pode ganhar `audioApagadoEm`. Teste na Tarefa 7.
2. **`ALERTA_EMAILS` com espaços ou itens vazios** (`" a@x.com, ,b@y.com ,"`) vira `["a@x.com","b@y.com"]` e não derruba a subida. Teste na Tarefa 2.
3. **Aceite de versão antiga** não vale para a versão atual: a pessoa aceita de novo. Teste na Tarefa 6.
4. **Falha da api ao consultar o aceite** não pode trancar ninguém fora do sistema (fail-open). Teste na Tarefa 9.
5. **`x-forwarded-for` com vários IPs** (`"200.1.1.1, 10.0.0.1"`) guarda só o primeiro. Teste na Tarefa 6.

---

## Parte 1 — Backup no R2

### Task 1: Rotina diária com cópia e restauração testada

**Arquivos:**
- Criar: `.github/workflows/rotina-diaria.yml`

**Interfaces:**
- Produz:
  - os jobs `copia`, `restauracao` e `aviso`. A Tarefa 7 acrescenta `limpeza-audio` e o põe em `aviso.needs`;
  - as saídas de `copia`: `arquivo` (`noteless-AAAA-MM-DD.dump.gpg`) e `major` (versão principal do Postgres do Neon).
- Segredos: `BACKUP_DATABASE_URL`, `BACKUP_SENHA`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `RESEND_API_KEY`, `ALERTA_EMAILS`.
- Variável: `vars.EMAIL_REMETENTE`. Sem ela, vale `Noteless <onboarding@resend.dev>`.

- [ ] **Passo 1: Escrever o workflow**

**Comentário no topo** (o estilo é o do `ci.yml`):
- o que a rotina faz;
- a lista de segredos;
- "Como restaurar", nos 4 passos da spec:
  1. baixar o `.gpg` e rodar `gpg --decrypt`;
  2. criar um branch ou um banco novo no Neon;
  3. rodar `pg_restore --no-owner --no-privileges -d <url>`;
  4. trocar o `DATABASE_URL` na Vercel só depois de conferir.

**Cabeçalho:**
- `on.schedule: cron "0 6 * * *"`;
- `on.workflow_dispatch.inputs.simular_falha`: boolean, padrão `false`;
- `permissions: contents: read`;
- `concurrency: { group: rotina-diaria, cancel-in-progress: false }`;
- `defaults.run.shell: bash`;
- `env` no nível do workflow: `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` dos segredos do R2, `AWS_DEFAULT_REGION: auto`, `AWS_ENDPOINT_URL: https://${{ secrets.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com`, `AWS_REQUEST_CHECKSUM_CALCULATION: when_required` e `AWS_RESPONSE_CHECKSUM_VALIDATION: when_required`.

**Jobs:** todos em `ubuntu-latest`. `copia` e `restauracao` têm 30 min de timeout; `aviso` tem 5 min. Comandos de cada um, com `PGURL` e `BACKUP_SENHA` passados por `env`, nunca na linha de comando:

```bash
# copia — 1º passo, só com simular_falha: falha antes de tocar no banco
echo "Falha simulada para conferir o e-mail de aviso."; exit 1

# copia — versão do servidor; cliente e servidor na mesma versão
NUM=$(docker run --rm -e PGURL postgres:18 sh -c 'psql "$PGURL" -tAc "show server_version_num"')
MAJOR=$((NUM / 10000)); ARQUIVO="noteless-$(date -u +%F).dump.gpg"
echo "major=$MAJOR" >> "$GITHUB_OUTPUT"; echo "arquivo=$ARQUIVO" >> "$GITHUB_OUTPUT"

# copia — diária
docker run --rm -e PGURL "postgres:$MAJOR" sh -c 'pg_dump --format=custom --no-owner --no-privileges "$PGURL"' > copia.dump
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --symmetric --cipher-algo AES256 -o "$ARQUIVO" copia.dump <<< "$BACKUP_SENHA"
aws s3 cp "$ARQUIVO" "s3://$R2_BUCKET/diario/$ARQUIVO"

# copia — mensal, só se [ "$(date -u +%d)" = "01" ]; mesmo pg_dump com
#   --exclude-table-data=ocorrencia_audio  →  mensal/noteless-$(date -u +%Y-%m).dump.gpg

# restauracao (needs: copia) — usa needs.copia.outputs.arquivo e .major
aws s3 cp "s3://$R2_BUCKET/diario/$ARQUIVO" "$ARQUIVO"
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 -o copia.dump -d "$ARQUIVO" <<< "$BACKUP_SENHA"
docker run -d --name pgteste -e POSTGRES_PASSWORD=teste "postgres:$MAJOR"
# TCP só responde depois do servidor definitivo (o de inicialização só ouve o socket)
until docker exec pgteste pg_isready -h 127.0.0.1 -U postgres; do sleep 1; done
docker cp copia.dump pgteste:/tmp/copia.dump
docker exec pgteste pg_restore -h 127.0.0.1 -U postgres -d postgres --no-owner --no-privileges --exit-on-error /tmp/copia.dump
for t in '"user"' organization ocorrencia lote; do
  echo "$t: $(docker exec pgteste psql -h 127.0.0.1 -U postgres -tAc "select count(*) from $t")"
done
test "$(docker exec pgteste psql -h 127.0.0.1 -U postgres -tAc 'select count(*) from "user"')" -gt 0

# aviso (needs: [copia, restauracao], if: failure()) — LINK = URL da execução
jq -n --arg de "${EMAIL_REMETENTE:-Noteless <onboarding@resend.dev>}" --arg para "$ALERTA_EMAILS" --arg link "$LINK" \
  '{from:$de, to:($para|split(",")|map(gsub("^ +| +$";""))|map(select(length>0))),
    subject:"[Noteless] rotina diária falhou",
    text:("Uma etapa da rotina diária (backup, restauração ou limpeza de áudio) falhou.\n"+$link)}' \
| curl -sS --fail-with-body -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" -H "Content-Type: application/json" -d @-
```

`LINK` vem de `${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}`.

Se a restauração acusar um objeto que só existe no Neon, deixe esse objeto de fora com `pg_restore -l` e `-L` e escreva o nome dele no comentário do arquivo. Qualquer outro erro precisa reprovar a rotina.

- [ ] **Passo 2: Validar o YAML**

Rode: `python3 -c 'import yaml; d=yaml.safe_load(open(".github/workflows/rotina-diaria.yml")); print(sorted(d["jobs"]))'`
Esperado: `['aviso', 'copia', 'restauracao']`

- [ ] **Passo 3: Commit**

```bash
npm test 2>&1 | tail -3
git add .github/workflows/rotina-diaria.yml
git commit -m "backup: rotina diária copia o banco para o R2 e testa a restauração"
```

- [ ] **Passo 4 (Arthur):**
  1. Configurar o R2, a Resend, os segredos do GitHub e a janela de restauração do Neon, como em "Configuração" na spec.
  2. Rodar a rotina à mão. Esperado: verde, o `.gpg` aparece em `diario/` e as contagens saem no log.
  3. Rodar de novo com `simular_falha`. Esperado: chega o e-mail.

---

## Parte 2 — Alerta por e-mail

### Task 2: E-mail pela Resend e alerta com limite

**Arquivos:**
- Modificar: `apps/api/src/env.ts`
- Criar: `apps/api/src/base/email.ts`, `apps/api/src/base/alerta.ts`
- Testes: `apps/api/test/env.test.ts` (acrescentar), `apps/api/test/base/email.test.ts`, `apps/api/test/base/alerta.test.ts`

**Interfaces — produz:**
```ts
// env.ts — novas chaves no schema
RESEND_API_KEY: z.string().optional()
EMAIL_REMETENTE: z.string().default("Noteless <onboarding@resend.dev>")
ALERTA_EMAILS: z.string().optional().transform(listaDeEmails)      // string[]
export function listaDeEmails(v: string | undefined): string[]     // divide por vírgula, apara, tira vazios; não valida formato

// base/email.ts
export type Email = { para: string[]; assunto: string; texto: string };
export async function enviarEmail(email: Email, opcoes?: { chave?: string; remetente?: string; fetch?: typeof fetch }): Promise<{ enviado: boolean }>

// base/alerta.ts
export type DetalheAlerta = { mensagem: string; rota?: string; orgId?: string };
export const JANELA_ALERTA_MS = 15 * 60 * 1000;
export function criarLimitador(janelaMs: number, agora?: () => number): (tipo: string) => boolean;
export function criarAlerta(deps: { enviar: (e: Email) => Promise<{ enviado: boolean }>; destinatarios: string[]; ambiente: string; agora?: () => number }):
  (tipo: string, detalhe: DetalheAlerta) => Promise<{ enviado: boolean }>;
export const alertar: (tipo: string, detalhe: DetalheAlerta) => Promise<{ enviado: boolean }>;
export function orgDaRota(caminho: string): string | undefined;   // "/api/org/<id>/..." → "<id>"
export function mensagemDe(e: unknown): string;                    // Error → message; outro → String(e)
```

- [ ] **Passo 1: Escrever os testes que falham**

```ts
// test/env.test.ts (acrescentar)
it("ALERTA_EMAILS vira lista sem espaços nem itens vazios", () => {
  expect(listaDeEmails(" a@x.com, ,b@y.com ,")).toEqual(["a@x.com", "b@y.com"]);
  expect(listaDeEmails(undefined)).toEqual([]);
});

// test/base/email.test.ts
const msg = { para: ["a@x.com"], assunto: "Assunto", texto: "Corpo" };
it("sem chave não chama a Resend", async () => {
  const f = vi.fn();
  expect(await enviarEmail(msg, { fetch: f })).toEqual({ enviado: false });
  expect(f).not.toHaveBeenCalled();
});
it("com chave manda remetente, destinatários e assunto", async () => {
  const f = vi.fn(async () => new Response("{}", { status: 200 }));
  expect(await enviarEmail(msg, { chave: "re_teste", remetente: "Noteless <avisos@noteless.com.br>", fetch: f })).toEqual({ enviado: true });
  const [url, init] = f.mock.calls[0]!;
  expect(url).toBe("https://api.resend.com/emails");
  expect(init.method).toBe("POST");
  expect(init.headers.Authorization).toBe("Bearer re_teste");
  expect(JSON.parse(init.body)).toEqual({ from: "Noteless <avisos@noteless.com.br>", to: ["a@x.com"], subject: "Assunto", text: "Corpo" });
});
it("sem destinatário não envia", async () => { /* para: [] com chave → { enviado: false }, fetch não chamado */ });
it("erro da Resend ou da rede não lança", async () => { /* Response 422 → { enviado: false }; fetch rejeitado → { enviado: false } */ });

// test/base/alerta.test.ts
it("o mesmo tipo sai uma vez a cada 15 min; outro tipo sai na hora", () => {
  let t = 0;
  const pode = criarLimitador(JANELA_ALERTA_MS, () => t);
  expect(pode("a")).toBe(true); expect(pode("a")).toBe(false); expect(pode("b")).toBe(true);
  t = JANELA_ALERTA_MS - 1; expect(pode("a")).toBe(false);
  t = JANELA_ALERTA_MS; expect(pode("a")).toBe(true);
});
it("monta o e-mail com tipo, hora de Brasília, rota, empresa e erro cortado em 500", async () => {
  const enviar = vi.fn(async () => ({ enviado: true }));
  const alertar = criarAlerta({ enviar, destinatarios: ["a@x.com"], ambiente: "prod", agora: () => Date.UTC(2026, 10, 16, 15, 0, 0) });
  await alertar("pipeline-audio", { mensagem: "x".repeat(800), rota: "POST /api/org/o1/ocorrencias", orgId: "o1" });
  const e = enviar.mock.calls[0]![0];
  expect(e.para).toEqual(["a@x.com"]);
  expect(e.assunto).toBe("[Noteless prod] pipeline-audio");
  expect(e.texto).toContain("16/11/2026"); expect(e.texto).toContain("12:00");
  expect(e.texto).toContain("Rota: POST /api/org/o1/ocorrencias"); expect(e.texto).toContain("Empresa: o1");
  expect(e.texto).toContain("x".repeat(500)); expect(e.texto).not.toContain("x".repeat(501));
});
it("segundo alerta do mesmo tipo em 15 min não sai", async () => { /* 2ª chamada → { enviado: false }, enviar 1 vez */ });
it("sem destinatários não chama o envio", async () => { /* destinatarios: [] → { enviado: false } */ });
it("envio que lança não lança", async () => { /* enviar rejeita → resolve { enviado: false } */ });
it("tira o id da empresa do caminho", () => {
  expect(orgDaRota("/api/org/abc-123/ocorrencias")).toBe("abc-123");
  expect(orgDaRota("/api/perfil")).toBeUndefined();
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npm test -w apps/api -- test/env.test.ts test/base`
Esperado: FAIL, porque `listaDeEmails`, `enviarEmail` e `criarAlerta` ainda não existem.

- [ ] **Passo 3: Implementar**

**`enviarEmail`:**
- `chave` e `remetente` têm como padrão `env.RESEND_API_KEY` e `env.EMAIL_REMETENTE`.
- Faz `POST` com JSON `{ from, to, subject, text }`, `Authorization: Bearer <chave>` e `signal: AbortSignal.timeout(5000)`.
- Resposta que não for `ok` vira `console.error` com o status e `{ enviado: false }`. Exceção também vira `{ enviado: false }`.

**Corpo do e-mail** (texto fixo):
```
Tipo: <tipo>
Quando: <data e hora em America/Sao_Paulo> (Brasília)
Rota: <rota ou —>
Empresa: <orgId ou —>
Erro: <mensagem cortada em 500>
```

**`alertar`** é `criarAlerta({ enviar: enviarEmail, destinatarios: env.ALERTA_EMAILS, ambiente })`, com:
- `ambiente = APP_ENV || (env.NODE_ENV === "production" ? "prod" : env.NODE_ENV)`, em que `APP_ENV` vem de `../load-env`;
- `JANELA_ALERTA_MS` como janela do limite.

O limite é conferido antes de enviar.

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npm test -w apps/api -- test/env.test.ts test/base`
Esperado: PASS

- [ ] **Passo 5: Commit**

```bash
npm test 2>&1 | tail -3
git add apps/api/src/env.ts apps/api/src/base/email.ts apps/api/src/base/alerta.ts apps/api/test/env.test.ts apps/api/test/base
git commit -m "alerta: e-mail pela Resend e alerta com limite de 15 min"
```

### Task 3: `/health` testa o banco e erro não tratado avisa

**Arquivos:**
- Modificar: `apps/api/src/app.ts:31` (`/health`) e acrescentar `app.onError`
- Testes: `apps/api/test/base/health.test.ts`, `apps/api/test/base/erro-api.test.ts`

**Interfaces:**
- Consome: `alertar`, `orgDaRota` e `mensagemDe` (Tarefa 2).

- [ ] **Passo 1: Escrever os testes que falham**

```ts
// test/base/health.test.ts
it("com o banco no ar responde 200 e não deixa guardar em cache", async () => {
  const r = await app.request("/health");
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true, banco: "ok" });
  expect(r.headers.get("cache-control")).toBe("no-store");
});
it("com o banco fora responde 503", async () => {
  vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("fora"));
  const r = await app.request("/health");
  expect(r.status).toBe(503);
  expect(await r.json()).toEqual({ ok: false, banco: "falhou" });
});

// test/base/erro-api.test.ts
vi.mock("../../src/base/alerta", async (o) => ({ ...(await o<typeof import("../../src/base/alerta")>()), alertar: vi.fn(async () => ({ enviado: true })) }));
beforeEach(() => vi.mocked(alertar).mockClear());
app.get("/teste/quebra", () => { throw new Error("quebrou"); });
app.get("/teste/bule", () => { throw new HTTPException(418, { message: "bule" }); });
it("erro não tratado responde 500 em JSON e alerta erro-api", async () => {
  const r = await app.request("/teste/quebra");
  expect(r.status).toBe(500);
  expect(await r.json()).toEqual({ error: "Erro interno." });
  expect(alertar).toHaveBeenCalledWith("erro-api", { mensagem: "quebrou", rota: "GET /teste/quebra", orgId: undefined });
});
it("HTTPException segue com a resposta dela e não alerta", async () => {
  const r = await app.request("/teste/bule");
  expect(r.status).toBe(418);
  expect(alertar).not.toHaveBeenCalled();
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npm test -w apps/api -- test/base`
Esperado: FAIL. O `/health` de hoje não traz `banco` e o erro ainda não vira JSON.

- [ ] **Passo 3: Implementar em `app.ts`**

**`/health`:**
- Manda `c.header("Cache-Control", "no-store")`.
- Roda `await db.execute(sql\`select 1\`)` num `try`.
- Responde `200 { ok: true, banco: "ok" }` ou `503 { ok: false, banco: "falhou" }`.

**`app.onError`:**
- Uma `HTTPException` devolve `err.getResponse()`.
- Qualquer outro erro faz quatro coisas: `console.error`, depois `await alertar("erro-api", { mensagem: mensagemDe(err), rota: \`${c.req.method} ${c.req.path}\`, orgId: orgDaRota(c.req.path) })`, e por fim responde `c.json({ error: "Erro interno." }, 500)`.

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npm test -w apps/api -- test/base`
Esperado: PASS

- [ ] **Passo 5: Commit**

```bash
npm test 2>&1 | tail -3
git add apps/api/src/app.ts apps/api/test/base
git commit -m "alerta: /health testa o banco e erro não tratado avisa por e-mail"
```

### Task 4: Falhas da IA nas notas avisam, e o super usuário testa o envio

**Arquivos:**
- Modificar: `apps/api/src/modulos/notas/rotas.ts` nos três pontos abaixo, e `apps/api/src/modulos/conta/rotas/admin.ts` (rota nova).
- Testes: `apps/api/test/notas/alerta.test.ts`, `apps/api/test/conta/alerta-teste.test.ts`

**Pontos em `notas/rotas.ts`:**

| Ponto | Tipo de alerta |
|---|---|
| `.catch` ao gravar `ocorrenciaAudio` (~l. 91) | `guardar-audio` |
| `catch` do pipeline de áudio, depois do `IaNaoConfigurada` (~l. 103) | `pipeline-audio` |
| `catch` da interpretação de texto, depois do `IaNaoConfigurada` (~l. 135) | `interpretar-texto` |

**Interfaces:**
- Consome: `alertar` e `mensagemDe` (Tarefa 2), e `barrar(c)`, que já existe em `admin.ts`.
- Produz: `POST /api/admin/alerta-teste` → `200 { enviado: boolean }`.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
// test/notas/alerta.test.ts — mocks de ia/transcrever e ia/analisar como em test/notas/gravacao.test.ts, mais:
vi.mock("../../src/base/alerta", async (o) => ({ ...(await o<typeof import("../../src/base/alerta")>()), alertar: vi.fn(async () => ({ enviado: true })) }));
beforeEach(() => vi.mocked(alertar).mockClear());
it("transcrição que falha responde 502 e alerta pipeline-audio", async () => {
  ia.transcrever.mockRejectedValueOnce(new Error("groq fora"));
  const r = /* POST multipart /api/org/:orgId/ocorrencias como em gravacao.test.ts */;
  expect(r.status).toBe(502);
  expect(alertar).toHaveBeenCalledWith("pipeline-audio", expect.objectContaining({ mensagem: "groq fora", orgId: f.orgId }));
});
it("IA não configurada responde 503 e não alerta", async () => { /* transcrever lança IaNaoConfigurada → 503, alertar não chamado */ });
it("texto que a IA não interpreta responde 502 e alerta interpretar-texto", async () => {
  /* cria nota pendente pelo áudio; analisar.mockRejectedValueOnce(new Error("ia fora")); POST /:orgId/ocorrencias/:id/texto → 502;
     alertar chamado com ("interpretar-texto", objectContaining({ mensagem: "ia fora", orgId })) */
});

// test/conta/alerta-teste.test.ts
it("super usuário pede o e-mail de teste", async () => {
  const r = await chamar(await criarSuper(), "POST", "/api/admin/alerta-teste");
  expect(r.status).toBe(200);
  expect(r.json).toEqual({ enviado: false }); // no teste não há RESEND_API_KEY
});
it("dono, administrador e membro não podem", async () => {
  const f = await criarFazenda("Alerta Teste");
  for (const p of [f.dono, f.admin, f.membro]) expect((await chamar(p, "POST", "/api/admin/alerta-teste")).status).toBe(403);
});
it("sem login, 401", async () => { expect((await chamar(null, "POST", "/api/admin/alerta-teste")).status).toBe(401); });
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npm test -w apps/api -- test/notas/alerta.test.ts test/conta/alerta-teste.test.ts`
Esperado: FAIL. O alerta não é chamado e a rota responde 404.

- [ ] **Passo 3: Implementar**

**Nos três pontos da tabela:**
- Mantenha o `console.error` e a resposta de hoje.
- Acrescente `await alertar(tipo, { mensagem: mensagemDe(e), rota: \`${c.req.method} ${c.req.path}\`, orgId })`.
- No `.catch` do áudio, a callback passa a ser `async`.

**Rota em `admin.ts`:** `adminRoutes.post("/alerta-teste", …)`.
- Primeiro passa por `barrar(c)`.
- Depois responde `c.json(await alertar("teste", { mensagem: "E-mail de teste pedido pelo super usuário.", rota: "POST /api/admin/alerta-teste" }))`.

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npm test -w apps/api -- test/notas test/conta`
Esperado: PASS, inclusive os testes que já existiam.

- [ ] **Passo 5: Commit**

```bash
npm test 2>&1 | tail -3
git add apps/api/src/modulos/notas/rotas.ts apps/api/src/modulos/conta/rotas/admin.ts apps/api/test/notas/alerta.test.ts apps/api/test/conta/alerta-teste.test.ts
git commit -m "alerta: falhas da IA nas notas avisam por e-mail e super usuário testa o envio"
```

**Passo 6 (Arthur):**
1. Pôr na Vercel (api) `RESEND_API_KEY`, `ALERTA_EMAILS` e `EMAIL_REMETENTE`.
2. Criar o vigia em `https://app.noteless.com.br/health`.
3. Depois do push, chamar `POST /api/admin/alerta-teste`. Esperado: chega o e-mail.

---

## Parte 3 — LGPD mínimo

### Task 5: Versão dos termos e prazo do áudio no shared

**Arquivos:**
- Criar: `packages/shared/src/conta/termos.ts`, `packages/shared/src/conta/termos.test.ts`
- Modificar:
  - `packages/shared/src/conta/index.ts`: acrescentar `export * from "./termos";`;
  - `packages/shared/src/notas/ocorrencias.ts:191-194`: acrescentar `audioApagadoEm` em `ocorrenciaSchema`.

**Interfaces — produz:**
```ts
export const VERSAO_TERMOS = "2026-11-16";
export const TERMOS_EM_VIGOR: boolean = false;   // anotado como boolean para o `if` não virar código morto no TS
export const DIAS_AUDIO = 90;
export const aceitarTermosSchema = z.object({ versao: z.literal(VERSAO_TERMOS, { error: "Esta versão dos termos não é a atual. Recarregue a página." }) });
export const aceiteTermosSchema = z.object({ versao: z.string(), aceitoEm: z.coerce.date().nullable() });
export type AceiteTermos = z.infer<typeof aceiteTermosSchema>;
// ocorrenciaSchema: audioApagadoEm: z.coerce.date().nullish()
```

- [ ] **Passo 1: Escrever o teste que falha**

```ts
it("aceita só a versão atual dos termos", () => {
  expect(aceitarTermosSchema.safeParse({ versao: VERSAO_TERMOS }).success).toBe(true);
  const velha = aceitarTermosSchema.safeParse({ versao: "2020-01-01" });
  expect(velha.success).toBe(false);
  expect(velha.error?.issues[0]?.message).toBe("Esta versão dos termos não é a atual. Recarregue a página.");
  expect(aceitarTermosSchema.safeParse({}).success).toBe(false);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npm test -w packages/shared -- src/conta/termos.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: Implementar `termos.ts` e o campo novo em `ocorrenciaSchema`**

- [ ] **Passo 4: Rodar e ver passar**

Rode: `npm test -w packages/shared -- src/conta/termos.test.ts`
Esperado: PASS

- [ ] **Passo 5: Commit**

```bash
npm test 2>&1 | tail -3
git add packages/shared/src/conta/termos.ts packages/shared/src/conta/termos.test.ts packages/shared/src/conta/index.ts packages/shared/src/notas/ocorrencias.ts
git commit -m "termos: versão, prazo do áudio e schema do aceite no shared"
```

### Task 6: Aceite dos termos na api (tabela, coluna e migration)

**Arquivos:**
- Modificar:
  - `apps/api/src/db/tabelas/conta.ts`: `aceiteTermos`;
  - `apps/api/src/db/tabelas/notas.ts`: `audioApagadoEm` em `ocorrencia`. A coluna entra agora para ficar numa migration só, e quem a usa é a Tarefa 7.
- Gerar: `apps/api/drizzle/0016_aceite_termos_e_audio_apagado.sql` e o `meta/`.
- Criar: `apps/api/src/modulos/conta/regras/termos.ts`, `apps/api/src/modulos/conta/rotas/termos.ts`
- Modificar:
  - `apps/api/src/modulos/conta/index.ts`: exportar `termosRoutes as termosRotas`;
  - `apps/api/src/app.ts`: `app.route("/api/perfil/termos", termosRotas)`;
  - `apps/api/test/ajuda.ts`: 5º parâmetro opcional `cabecalhos?: Record<string, string>` em `chamar`.
- Teste: `apps/api/test/conta/termos.test.ts`

**Interfaces — produz:**
```ts
// tabelas/conta.ts — id no padrão das outras tabelas (text + $defaultFn(crypto.randomUUID))
export const aceiteTermos = pgTable("aceite_termos", {
  id, userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  versao: text("versao").notNull(), aceitoEm: timestamp("aceito_em").notNull().defaultNow(), ip: text("ip"),
}, (t) => [uniqueIndex("aceite_termos_user_versao_uq").on(t.userId, t.versao)]);
// tabelas/notas.ts — em ocorrencia: audioApagadoEm: timestamp("audio_apagado_em")

// regras/termos.ts
export async function aceiteDaVersao(userId: string, versao: string): Promise<Date | null>
export async function aceitarTermos(userId: string, entrada: unknown, ip: string | null): Promise<Resultado<{ aceitoEm: Date }>>
  // valida com aceitarTermosSchema → falha(400, mensagem); insert … onConflictDoNothing; devolve o aceitoEm gravado (o primeiro)

// rotas/termos.ts — sessão via auth.api.getSession como em rotas/perfil.ts; sem sessão → 401 { error: "Não autenticado." }
export const termosRoutes: Hono   // GET "/" → { versao: VERSAO_TERMOS, aceitoEm }; POST "/" → { aceitoEm } | 400 { error }
// IP: primeiro item de x-forwarded-for, aparado; sem cabeçalho → null
```

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("sem login, 401", async () => {
  expect((await chamar(null, "GET", "/api/perfil/termos")).status).toBe(401);
  expect((await chamar(null, "POST", "/api/perfil/termos", { versao: VERSAO_TERMOS })).status).toBe(401);
});
it("antes de aceitar, aceitoEm vem nulo", async () => {
  const f = await criarFazenda("Termos A");
  const r = await chamar(f.membro, "GET", "/api/perfil/termos");
  expect(r.status).toBe(200);
  expect(r.json).toEqual({ versao: VERSAO_TERMOS, aceitoEm: null });
});
it("aceita a versão atual e o aceite fica registrado", async () => {
  /* POST { versao: VERSAO_TERMOS } → 200 com aceitoEm; GET devolve o mesmo aceitoEm */
});
it("versão que não é a atual dá 400 e nada é gravado", async () => {
  /* POST { versao: "2020-01-01" } → 400 { error: "Esta versão dos termos não é a atual. Recarregue a página." }; GET → aceitoEm null */
});
it("aceitar de novo mantém o primeiro registro", async () => { /* dois POST → GET devolve o aceitoEm do primeiro */ });
it("o aceite de um usuário não vale para outro", async () => { /* dono aceita; admin da mesma fazenda → aceitoEm null */ });
it("aceite de versão antiga não vale para a atual", async () => {
  const f = await criarFazenda("Termos Velhos");
  await db.insert(aceiteTermos).values({ userId: f.dono.id, versao: "2020-01-01" });
  expect((await chamar(f.dono, "GET", "/api/perfil/termos")).json.aceitoEm).toBeNull();
});
it("guarda só o primeiro IP de x-forwarded-for", async () => {
  const f = await criarFazenda("Termos IP");
  const r = await chamar(f.dono, "POST", "/api/perfil/termos", { versao: VERSAO_TERMOS }, { "x-forwarded-for": "200.1.1.1, 10.0.0.1" });
  expect(r.status).toBe(200);
  const [linha] = await db.select().from(aceiteTermos).where(eq(aceiteTermos.userId, f.dono.id));
  expect(linha!.ip).toBe("200.1.1.1");
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npm test -w apps/api -- test/conta/termos.test.ts`
Esperado: FAIL. A rota responde 404 e a tabela não existe.

- [ ] **Passo 3: Mexer nas tabelas e gerar a migration**

Rode: `npm run db:generate -w apps/api -- --name aceite_termos_e_audio_apagado`

O comando não conecta no banco; só compara os schemas. Esperado: um arquivo novo `0016_aceite_termos_e_audio_apagado.sql`, com somente estas quatro coisas:
- `CREATE TABLE "aceite_termos"`;
- a FK para `"user"` com `ON DELETE cascade`;
- `CREATE UNIQUE INDEX "aceite_termos_user_versao_uq"`;
- `ALTER TABLE "ocorrencia" ADD COLUMN "audio_apagado_em" timestamp`.

Se aparecer qualquer outra coisa, pare e avise o Arthur. **Não** rode `db:migrate`.

- [ ] **Passo 4: Implementar a regra, a rota, a montagem em `app.ts` e o parâmetro novo de `chamar`**

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npm test -w apps/api -- test/conta`
Esperado: PASS

- [ ] **Passo 6: Commit**

```bash
npm test 2>&1 | tail -3
git add apps/api/src/db/tabelas/conta.ts apps/api/src/db/tabelas/notas.ts apps/api/drizzle apps/api/src/modulos/conta apps/api/src/app.ts apps/api/test/ajuda.ts apps/api/test/conta/termos.test.ts
git commit -m "termos: aceite registrado na api e coluna de áudio apagado na nota"
```

### Task 7: Áudio apagado 90 dias depois da revisão

**Arquivos:**
- Criar: `apps/api/src/modulos/notas/regras/limpeza-audio.ts`, `apps/api/src/modulos/notas/rotinas.ts`
- Modificar:
  - `apps/api/src/modulos/notas/index.ts`: exportar `rotinasRoutes as rotinasRotas`;
  - `apps/api/src/app.ts`: `app.route("/api/rotinas", rotinasRotas)`;
  - `apps/api/src/env.ts`: `ROTINAS_SEGREDO: z.string().optional()`;
  - `apps/api/src/modulos/notas/consultas.ts`: `audioApagadoEm` no select e no retorno de `buscar`;
  - `.github/workflows/rotina-diaria.yml`: job `limpeza-audio` e `aviso.needs`.
- Teste: `apps/api/test/notas/limpeza-audio.test.ts`

**Interfaces:**
- Consome: `DIAS_AUDIO` (Tarefa 5), a coluna `ocorrencia.audioApagadoEm` (Tarefa 6) e `ocorrenciaAudio`.
- Produz:
```ts
export async function apagarAudiosVencidos(agora: Date, limite = 1000): Promise<number>
  // numa transação: ids = ocorrencia INNER JOIN ocorrencia_audio
  //   onde status in ('confirmada','descartada') e revisadoEm < agora − DIAS_AUDIO dias, limit `limite`;
  //   delete ocorrencia_audio where ocorrenciaId in ids; update ocorrencia set audioApagadoEm = agora where id in ids;
  //   devolve ids.length
export const rotinasRoutes: Hono   // POST "/limpeza-audio"
  // lê env.ROTINAS_SEGREDO a cada chamada: ausente → 503 { error: "Rotina não configurada." };
  // Authorization ≠ "Bearer <segredo>" (comparação com timingSafeEqual) → 401 { error: "Não autorizado." };
  // ok → 200 { apagados }
```

- [ ] **Passo 1: Escrever os testes que falham**

```ts
const agora = new Date("2026-11-16T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);
// ajudas locais: notaComAudio(orgId, status, revisadoEm) e notaSemAudio(...) inserem direto em ocorrencia / ocorrencia_audio
it("apaga o áudio de nota confirmada há 91 dias e marca a data", async () => {
  const id = await notaComAudio(f.orgId, "confirmada", diasAtras(91));
  await apagarAudiosVencidos(agora);
  expect(await temAudio(id)).toBe(false);
  expect((await nota(id)).audioApagadoEm).toEqual(agora);
});
it("mantém o áudio de nota confirmada há 89 dias", async () => { /* temAudio → true; audioApagadoEm → null */ });
it("apaga o áudio de nota descartada há 91 dias", async () => { /* temAudio → false */ });
it("não toca em nota pendente antiga nem em nota restaurada", async () => { /* status pendente, revisadoEm null, createdAt 200 dias → temAudio true */ });
it("nota sem áudio não ganha data de áudio apagado", async () => {
  const id = await notaSemAudio(f.orgId, "confirmada", diasAtras(91));
  await apagarAudiosVencidos(agora);
  expect((await nota(id)).audioApagadoEm).toBeNull();
});
it("vale para todas as empresas", async () => { /* duas fazendas, uma nota vencida em cada → as duas sem áudio */ });
it("a nota mostra quando o áudio foi apagado", async () => {
  /* depois da limpeza: const [n] = await buscar(f.orgId, id) (de src/modulos/notas/consultas) → n.temAudio false, n.audioApagadoEm = agora */
});
// rota — import { env } from "../../src/env"; afterEach(() => { env.ROTINAS_SEGREDO = undefined; })
it("sem ROTINAS_SEGREDO configurado responde 503", async () => { /* POST /api/rotinas/limpeza-audio → 503 */ });
it("sem segredo ou com segredo errado responde 401", async () => { /* env.ROTINAS_SEGREDO = "s".repeat(64); sem header e com "Bearer errado" → 401 */ });
it("com o segredo certo responde 200 com quantos apagou", async () => { /* → 200, typeof json.apagados === "number" */ });
```

Os testes da rota usam `app.request` direto, com o cabeçalho `Authorization`. Não usam sessão.

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npm test -w apps/api -- test/notas/limpeza-audio.test.ts`
Esperado: FAIL, porque `apagarAudiosVencidos` não existe.

- [ ] **Passo 3: Implementar a regra, a rota, as montagens e o `audioApagadoEm` em `buscar`**

- [ ] **Passo 4: Acrescentar o job `limpeza-audio` no workflow**

- `needs: copia`, assim nunca apaga áudio num dia em que a cópia falhou.
- `timeout-minutes: 5`.
- O passo: `curl -sS --fail-with-body -X POST "$APP_URL/api/rotinas/limpeza-audio" -H "Authorization: Bearer $ROTINAS_SEGREDO"`, com `APP_URL: ${{ vars.APP_URL }}` e `ROTINAS_SEGREDO: ${{ secrets.ROTINAS_SEGREDO }}`.
- `aviso.needs` passa a ser `[copia, restauracao, limpeza-audio]`.

Valide o YAML como no Passo 2 da Tarefa 1. Esperado: `['aviso', 'copia', 'limpeza-audio', 'restauracao']`.

- [ ] **Passo 5: Rodar e ver passar**

Rode: `npm test -w apps/api -- test/notas`
Esperado: PASS

- [ ] **Passo 6: Commit**

```bash
npm test 2>&1 | tail -3
git add apps/api/src/modulos/notas apps/api/src/app.ts apps/api/src/env.ts apps/api/test/notas/limpeza-audio.test.ts .github/workflows/rotina-diaria.yml
git commit -m "notas: áudio apagado 90 dias depois da revisão, por rotina diária"
```

### Task 8: Páginas de privacidade, termos e aviso do gravador

**Arquivos:**
- Criar:
  - `apps/web/src/app/(publico)/layout.tsx`: mostra a faixa "Rascunho em revisão — este texto ainda não está em vigor." quando `!TERMOS_EM_VIGOR`;
  - `apps/web/src/app/(publico)/privacidade/page.tsx`, `termos/page.tsx` e `aviso-gravador/page.tsx`: páginas finas.
- Criar em `apps/web/src/modulos/conta/componentes/legal/`:
  - `privacidade.tsx`, `termos.tsx` e `aviso-gravador.tsx`: um texto por arquivo;
  - `links-legais.tsx`: devolve `null` quando `!TERMOS_EM_VIGOR`.
- Modificar:
  - `apps/web/src/modulos/conta/index.ts`: exportar os componentes acima;
  - `apps/web/src/app/(auth)/login/page.tsx`: `<LinksLegais />` abaixo do formulário;
  - `apps/web/src/app/(app)/perfil/page.tsx`: `<LinksLegais />`;
  - `apps/web/src/app/(app)/configuracoes/gravadores/page.tsx`: link para `/aviso-gravador`, só quando `TERMOS_EM_VIGOR`.

**Interfaces:**
- Consome: `VERSAO_TERMOS`, `TERMOS_EM_VIGOR` e `DIAS_AUDIO` (Tarefa 5), e o nome do produto de `src/lib/brand.ts`. Não escreva "Noteless" à mão.
- Produz: `export function Privacidade()`, `Termos()`, `AvisoGravador()` e `LinksLegais()` por `@/modulos/conta`.

**Conteúdo:**
- Siga os tópicos de "Textos" na spec, com os espaços em branco exatos: `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]`, `[E-MAIL DE CONTATO]`, `[CIDADE/UF]` e, no aviso, `[NOME DA EMPRESA]`.
- A Privacidade diz também que o áudio apagado pode ficar até 30 dias nas cópias diárias de segurança.
- Cada texto mostra "Versão de 16/11/2026", gerado a partir de `VERSAO_TERMOS`.
- O aviso do gravador usa `@media print`, para caber em uma folha A4.
- Os componentes visuais vêm de `@/components/ui`.
- Se algum texto passar de ~300 linhas, divida por seção.

- [ ] **Passo 1: Escrever páginas, textos, links e o link em Gravadores**

- [ ] **Passo 2: Verificar**

Rode: `npm run typecheck && npm run lint && npm test 2>&1 | tail -3 && npm run build`
Esperado: tudo verde. O `estrutura.test.ts` do web passa.

Abra `/privacidade`, `/termos` e `/aviso-gravador` no preview do web, sem login. Esperado: o texto aparece com a faixa de rascunho. O login e o perfil ficam sem os links, porque os termos estão fora de vigor.

- [ ] **Passo 3: Commit**

```bash
git add "apps/web/src/app/(publico)" apps/web/src/modulos/conta "apps/web/src/app/(auth)/login/page.tsx" "apps/web/src/app/(app)/perfil/page.tsx" "apps/web/src/app/(app)/configuracoes/gravadores/page.tsx"
git commit -m "lgpd: páginas de privacidade, termos e aviso do gravador (rascunho, fora de vigor)"
```

### Task 9: Aceite na entrada e aviso de áudio apagado na nota

**Arquivos:**
- Criar:
  - `apps/web/src/modulos/conta/aceite.ts` e `apps/web/src/modulos/conta/aceite.test.ts`;
  - `apps/web/src/modulos/conta/componentes/aceite-form.tsx` (`"use client"`);
  - `apps/web/src/app/(auth)/aceite/page.tsx`.
- Modificar:
  - `apps/web/src/modulos/conta/dados.ts`: `getAceite`;
  - `apps/web/src/modulos/conta/index.ts`;
  - `apps/web/src/app/(app)/layout.tsx`: o redirect;
  - `apps/web/src/proxy.ts`: `"/aceite"` em `ROTAS_PROTEGIDAS`;
  - `apps/web/src/modulos/notas/componentes/detalhe.tsx:137`.

**Interfaces:**
- Consome: `AceiteTermos`, `VERSAO_TERMOS`, `TERMOS_EM_VIGOR` e `DIAS_AUDIO` (Tarefa 5), `GET` e `POST /api/perfil/termos` (Tarefa 6) e `audioApagadoEm` na nota (Tarefa 7).
- Produz:
```ts
// modulos/conta/aceite.ts (pura)
export function precisaAceitar(aceite: AceiteTermos | null, emVigor: boolean): boolean
  // !emVigor → false; aceite null (a api falhou) → false; aceitoEm null → true; senão false
// modulos/conta/dados.ts (server-only)
export const getAceite: () => Promise<AceiteTermos | null>   // apiFetch("/api/perfil/termos"); erro ou !ok → null
```

- [ ] **Passo 1: Escrever o teste que falha**

```ts
it("termos fora de vigor: ninguém é levado ao aceite", () => {
  expect(precisaAceitar({ versao: VERSAO_TERMOS, aceitoEm: null }, false)).toBe(false);
});
it("em vigor e sem aceite: vai para o aceite", () => {
  expect(precisaAceitar({ versao: VERSAO_TERMOS, aceitoEm: null }, true)).toBe(true);
});
it("em vigor e já aceito: segue", () => {
  expect(precisaAceitar({ versao: VERSAO_TERMOS, aceitoEm: new Date() }, true)).toBe(false);
});
it("a api falhou ao consultar: não tranca ninguém", () => {
  expect(precisaAceitar(null, true)).toBe(false);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rode: `npm test -w apps/web -- src/modulos/conta/aceite.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: Implementar**

**`aceite.ts` e `getAceite`:** conforme a interface acima.

**Layout de `(app)`:** depois do `requireSession()`, faz `if (precisaAceitar(await getAceite(), TERMOS_EM_VIGOR)) redirect("/aceite")`.

**Página `/aceite`:**
1. `await requireSession()`.
2. Se `!TERMOS_EM_VIGOR`, vai para `redirect("/dashboard")`.
3. Se `(await getAceite())?.aceitoEm` já existe, vai para `redirect("/dashboard")`.
4. Senão, mostra `<AceiteForm versao={VERSAO_TERMOS} />`.

**`AceiteForm`:**
- Uma caixa "Li e aceito os Termos de Uso e a Política de Privacidade", com links para `/termos` e `/privacidade` em aba nova.
- O botão "Continuar" fica desabilitado até a caixa ser marcada.
- O clique faz `fetch("/api/perfil/termos", { method: "POST", … { versao } })`. Deu certo: `router.replace("/dashboard")`. Deu erro: mostra o `json.error`.
- O estilo segue o `perfil-form.tsx`.

**`detalhe.tsx`:**
- Com `oc.audioApagadoEm`, mostra "Áudio apagado em <data> — guardado por {DIAS_AUDIO} dias depois da revisão." no lugar do `<Audio>`.
- A data sai pelo formatador de `src/lib/datas.ts`.

- [ ] **Passo 4: Verificar**

Rode: `npm test -w apps/web -- src/modulos/conta/aceite.test.ts`, depois `npm run typecheck && npm run lint && npm test 2>&1 | tail -3 && npm run build`
Esperado: PASS e tudo verde.

Não ligue `TERMOS_EM_VIGOR` contra o banco compartilhado. A conferência no navegador fica para depois da migration autorizada.

- [ ] **Passo 5: Commit**

```bash
git add apps/web/src/modulos/conta "apps/web/src/app/(auth)/aceite" "apps/web/src/app/(app)/layout.tsx" apps/web/src/proxy.ts apps/web/src/modulos/notas/componentes/detalhe.tsx
git commit -m "lgpd: aceite dos termos na entrada e aviso de áudio apagado na nota"
```

**Passo 6 (Arthur):**
1. Pôr `ROTINAS_SEGREDO` na Vercel (api) e nos segredos do GitHub, e `APP_URL` nas variáveis do GitHub.
2. Autorizar a migration 0016.
3. Fazer o push.
4. Depois da revisão do advogado: preencher os espaços em branco, trocar `VERSAO_TERMOS` pela data da publicação e ligar `TERMOS_EM_VIGOR`.

---

## Fechamento

- [ ] Rode `npm run typecheck && npm run lint && npm test && npm run build` na raiz. Esperado: tudo verde.
- [ ] Peça uma revisão de código da branch inteira (superpowers:requesting-code-review) e corrija o que for confirmado.
