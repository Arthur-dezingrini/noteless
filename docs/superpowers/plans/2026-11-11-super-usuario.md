# Super usuário e vínculos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tipo de usuário `super` que vincula qualquer usuário a qualquer empresa pela aba Configurações › Vínculos; o administrador da empresa gerencia só a própria.

**Architecture:**
- `user.tipo` entra como campo extra do Better Auth.
- As rotas `/api/admin/*` ficam no módulo `conta` da api, guardadas por `superUsuario()` em `base/`.
- O web ganha a aba Vínculos no módulo `conta`.
- O "vincular por e-mail" da empresa sai.

**Tech Stack:** Hono, Better Auth (organization), Drizzle/PGlite nos testes, Next.js 16, Zod.

**Spec:** `docs/superpowers/specs/2026-11-11-super-usuario-design.md`

## Global Constraints

- **Banco compartilhado:** `npm run db:migrate` e `npm run super` **não rodam** sem o Arthur autorizar no chat, na hora. Nenhuma task deste plano os roda; a Task 4 pede a autorização.
- **`schema.ts` só por `npm run auth:generate`.** A migration só por `drizzle-kit generate`, que precisa sair com exatamente uma coluna nova: `tipo text default 'comum' not null`.
- **Textos exatos:**
  - `"Só o super usuário mexe nos vínculos."` (403);
  - `"Essa pessoa já está nessa empresa."` (409);
  - `"A empresa ficaria sem dono."` (422);
  - `"Precisa sobrar pelo menos um super usuário."` (422);
  - `"Usuário não encontrado."` e `"Empresa não encontrada."` (404);
  - `"Vínculo não encontrado."` (404).
- **Padrão de módulo** do CLAUDE.md:
  - rotas só HTTP;
  - regras devolvem `Resultado`;
  - teste em `test/conta/`;
  - web com `dados.ts` server-only.
- **Gate de cada commit:** `npm run typecheck && npm run lint && npm test`. A Task 3 também roda o build.
- **Commit** na `main`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` por caminho; o `.claude/launch.json` fica de fora.
- **Node 24:** `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`.

## Review Focus

1. **Alguém se fazer super** pelo update de usuário do Better Auth (`/api/auth/update-user` com `tipo`). O `input: false` precisa barrar isso; um teste cobre.
2. **Dono de empresa chamando `/api/admin`** recebe 403. Ele não é super, mesmo sendo dono de tudo na empresa dele.
3. **Empresa sem dono** depois de mudar papel ou desvincular: as duas rotas checam.
4. **O último super se rebaixando** e se trancando fora: 422.
5. **Super usuário trocando para empresa sem vínculo:** o `set-active` recusa, como para todos.

---

### Task 1: tipo de usuário, migration e guarda

**Files:**
- Modify:
  - `apps/api/src/auth.ts` (`user.additionalFields.tipo`);
  - `apps/api/src/db/schema.ts`, só via `auth:generate`;
  - `packages/shared/src/conta/auth.ts` (`tipoUsuarioSchema`, `sessionSchema.user.tipo`);
  - `apps/api/test/ajuda.ts`.
- Create:
  - `apps/api/drizzle/00xx_*.sql`, gerado;
  - `apps/api/src/base/super-usuario.ts`;
  - `apps/api/src/db/super.ts` (comando);
  - o script `"super"` no `apps/api/package.json`;
  - `apps/api/test/conta/super-usuario.test.ts`.

**Interfaces (Produces):**
- `tipoUsuarioSchema`, `type TipoUsuario = "comum" | "super"` (shared).
- `superUsuario(headers: Headers): Promise<{ userId: string } | null>` (api/base).
- Em `test/ajuda.ts`: `criarSuper(nome?: string): Promise<Pessoa>` cria o usuário, faz `update user set tipo='super'` no PGlite e entra.

**Passos:**
- [ ] **Step 1: Teste.** Escrever `test/conta/super-usuario.test.ts`:
  ```ts
  it("usuário novo nasce comum e não vira super pelo update do perfil", async () => {
    const f = await criarFazenda("Tipo");
    await chamar(f.dono, "POST", "/api/auth/update-user", { tipo: "super" });
    const s = await chamar(f.dono, "GET", "/api/auth/get-session");
    expect(s.json.user.tipo).toBe("comum");
  });
  it("criarSuper devolve sessão com tipo super", async () => {
    const s = await chamar(await criarSuper(), "GET", "/api/auth/get-session");
    expect(s.json.user.tipo).toBe("super");
  });
  it("set-active para empresa sem vínculo é recusado, até para super", async () => {
    const a = await criarFazenda("Alfa"); const b = await criarFazenda("Beta");
    const sup = await criarSuper();
    for (const quem of [a.dono, sup]) {
      const r = await chamar(quem, "POST", "/api/auth/organization/set-active", { organizationId: b.orgId });
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
  });
  ```
- [ ] **Step 2: Ver falhar.** Rodar `npx vitest run test/conta/super-usuario.test.ts` e conferir que falha porque `criarSuper` não existe.
- [ ] **Step 3: Implementar.**
  - Em `auth.ts`: `tipo: { type: "string", required: false, defaultValue: "comum", input: false }`.
  - Rodar `npm run auth:generate -w @vocare/api`.
  - Em `apps/api`, rodar `npx drizzle-kit generate --name tipo_usuario`. Conferir que o SQL tem só `ALTER TABLE "user" ADD COLUMN "tipo" text DEFAULT 'comum' NOT NULL`. A migration **não** é aplicada no Neon. O PGlite dos testes aplica sozinho.
  - Escrever o shared, a `base/super-usuario.ts` (usa `auth.api.getSession({ headers })`, sem tocar no banco), o `criarSuper` e o `db/super.ts`:
    - lê `process.argv[2]` (e-mail);
    - faz `update user set tipo='super' where email=…`;
    - sai com erro se ninguém tiver esse e-mail;
    - no padrão de `seed.ts`.
- [ ] **Step 4: Ver passar, e rodar o gate.**
- [ ] **Step 5: Commit** `conta: tipo de usuário (comum ou super) e guarda superUsuario`.

---

### Task 2: rotas `/api/admin` e saída do vincular por e-mail

**Files:**
- Create:
  - `apps/api/src/modulos/conta/rotas/admin.ts`;
  - `apps/api/src/modulos/conta/regras/vinculos.ts`;
  - `apps/api/src/modulos/conta/consultas/admin.ts`;
  - `packages/shared/src/conta/admin.ts` (exportado no `conta/index.ts`);
  - `apps/api/test/conta/admin.test.ts`.
- Modify:
  - `apps/api/src/modulos/conta/index.ts` e `src/app.ts` (`app.route("/api/admin", adminRotas)`);
  - `apps/api/src/modulos/conta/rotas/usuarios.ts`, de onde sai `POST /:orgId/usuarios/vincular`;
  - `packages/shared/src/conta/usuarios.ts`, de onde sai `vincularUsuarioSchema`;
  - `apps/api/test/conta/usuarios.test.ts`, de onde saem os testes de vincular, cobertos agora em `admin.test.ts`;
  - no web, quem importa `vincularUsuarioSchema`: o `vincular-modal.tsx` sai e o `usuarios-lista.tsx` perde o botão.

**Interfaces (shared, Produces):**
```ts
export const vinculoSchema = z.object({ memberId: z.string(), organizationId: z.string(), empresa: z.string(), papel: papelSchema });
export const usuarioAdminSchema = z.object({ id: z.string(), nome: z.string(), email: z.string(), cargo: z.string().nullable(), tipo: tipoUsuarioSchema, vinculos: z.array(vinculoSchema) });
export const empresaSchema = z.object({ id: z.string(), nome: z.string() });
export const criarVinculoSchema = z.object({ userId: z.string().min(1), organizationId: z.string().min(1), papel: papelSchema });
export const mudarPapelSchema = z.object({ papel: papelSchema });
export const mudarTipoSchema = z.object({ tipo: tipoUsuarioSchema });
```

**Regras** (`regras/vinculos.ts`, todas `Promise<Resultado<…>>`):
- `vincular(dados)`;
- `mudarPapel(memberId, papel)`;
- `desvincular(memberId)`;
- `mudarTipo(userId, tipo)`.

Como contar "último dono" e "último super":
- **Último dono:** contar `member.role` que **contém** `owner` na empresa, porque o Better Auth guarda papéis separados por vírgula. O vínculo é o último dono quando a contagem é 1 e ele mesmo é dono.
- **Último super:** contar `user.tipo = 'super'`.

**Passos:**
- [ ] **Step 1: Teste.** `admin.test.ts`, usando `criarSuper` e `criarFazenda`. Os casos:
  - **Acesso:**
    - `GET /api/admin/usuarios`: sem login dá 401; `f.dono` dá 403 com o texto exato; super dá 200, com os vínculos da fazenda e o papel de cada um.
    - `GET /api/admin/usuarios?busca=` filtra por e-mail sem diferença de maiúscula.
    - `GET /api/admin/empresas`: super vê as duas fazendas criadas.
  - **Vincular:**
    - `POST /api/admin/vinculos` liga `a.membro` à fazenda `b` como `member` (201), e `a.membro` passa a ver `b` em `organization/list`.
    - O segundo POST igual dá 409.
    - Empresa inexistente dá 404 `"Empresa não encontrada."`; usuário inexistente dá 404.
  - **Mudar papel:**
    - `PATCH /api/admin/vinculos/:id` para `admin` dá 200.
    - Rebaixar o único dono para `member` dá 422 `"A empresa ficaria sem dono."`.
  - **Desvincular:**
    - `DELETE` de um membro dá 200, e a pessoa some de `organization/list`.
    - `DELETE` do único dono dá 422.
  - **Tipo:**
    - `PATCH /api/admin/usuarios/:id {tipo:"super"}` dá 200, e a sessão do alvo mostra `super`.
    - O único super tirando o próprio super dá 422 `"Precisa sobrar pelo menos um super usuário."`.
    - Com dois supers, um pode tirar o do outro (200).
  - **Fim do vincular por e-mail:** `POST /api/org/:orgId/usuarios/vincular` dá 404.
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar.**
  - Rotas: começam por `const eu = await superUsuario(c.req.raw.headers)`. Sem sessão dá 401 (conferir com `auth.api.getSession`); não-super dá 403.
  - Consultas: `listarUsuariosAdmin(busca?)` e `listarEmpresas()`. A primeira faz o join `user` × `member` × `organization`, ordenado por nome.
- [ ] **Step 4: Ver passar, e rodar o gate.**
- [ ] **Step 5: Commit** `conta: super usuário vincula qualquer usuário a qualquer empresa (/api/admin)`.

---

### Task 3: aba Vínculos no web

**Files:**
- Create:
  - `apps/web/src/app/(app)/configuracoes/vinculos/page.tsx`;
  - `apps/web/src/modulos/conta/componentes/vinculos/{vinculos-lista,vincular-modal,linha-usuario}.tsx`.
- Modify:
  - `apps/web/src/modulos/conta/dados.ts` (`getUsuariosAdmin(busca?: string)` e `getEmpresas()`, ambos `cache`, lista vazia se a resposta não for ok);
  - `apps/web/src/modulos/conta/index.ts`;
  - `config-nav.tsx` (aba Vínculos só quando `ehSuper`);
  - `app/(app)/configuracoes/layout.tsx` (entra admin **ou** super, e passa `ehSuper` para o `ConfigNav`);
  - `components/app/sidebar.tsx` e `app/(app)/layout.tsx` (rodapé para admin **ou** super);
  - `lib/auth/dal.ts`: `ehSuper(session)`, ou ler `session.user.tipo === "super"`.

**Passos:**
- [ ] **Step 1: Página.**
  - Busca por `?busca=`, com formulário GET.
  - Sem super, `notFound()`.
- [ ] **Step 2: Lista.** Por usuário:
  - nome, e-mail e a etiqueta "super usuário";
  - os vínculos ("Fazenda X · Administrador");
  - em cada vínculo, um `Menu` com "Mudar papel" (submenu dos três papéis) e "Desvincular" (abre `ConfirmBar`);
  - o botão "Vincular a uma empresa", que abre `Modal` com `Select` de empresa e de papel;
  - o botão "Marcar como super usuário" ou "Tirar super usuário", com `ConfirmBar`.
  - As chamadas vão por `chamarApi`, seguidas de `router.refresh()`. O erro aparece em `FormMessage`, com o texto da api.
- [ ] **Step 3: Gate + build:** `npm run typecheck && npm run lint && npm test && npm run build -w @vocare/web`.
- [ ] **Step 4: Commit** `web: Configurações › Vínculos para super usuário`.

---

### Task 4: banco de verdade e conferência

- [ ] **Step 1: Pedir autorização ao Arthur,** no chat, descrevendo exatamente o que roda:
  1. `npm run db:migrate`, que aplica no Neon compartilhado (dev, hom e prod) a migration com a coluna `tipo`;
  2. `npm run super -w @vocare/api -- <e-mail dele>`, que é um `UPDATE` de uma linha.

  Só depois do "pode rodar" executar, um de cada vez, mostrando a saída.
- [ ] **Step 2:** Com o Arthur logado no navegador, abrir Configurações › Vínculos, vincular um usuário de teste a outra empresa e desfazer.
- [ ] **Step 3:** Fazer a revisão final e passar o resumo das decisões.
