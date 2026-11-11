/**
 * Marca uma pessoa como super usuário: `npm run super -w @vocare/api -- <email>`.
 * Grava no banco do .env — no projeto, dev/hom/prod são o mesmo host.
 */
import { eq } from "drizzle-orm";

import { db } from ".";
import { user } from "./schema";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Uso: npm run super -w @vocare/api -- "email@exemplo.com"');
  const feito = await db.update(user).set({ tipo: "super" }).where(eq(user.email, email)).returning({ id: user.id });
  if (feito.length === 0) throw new Error(`Ninguém com o e-mail ${email}.`);
  console.log(`${email} agora é super usuário.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
