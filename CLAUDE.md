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

## Comandos (na raiz)

- `npm run dev` — sobe web (:3000) e api (:4000) juntos via Turborepo
- `npm run build` / `npm run lint` / `npm run typecheck`
- `npm test` — testes de unidade (Vitest), ao lado do arquivo: `x.ts` → `x.test.ts`
- `npm run db:migrate` / `npm run seed -- "<org>" <email> <senha>`
