/**
 * Cria a primeira organização e o primeiro usuário.
 *
 * Passa pela API do Better Auth de propósito: é ela que define o algoritmo de
 * hash da senha. Inserir direto no Postgres geraria um usuário que nunca
 * consegue entrar.
 *
 *   npm run seed -- "Fazenda Santa Rita" arthur@vocare.com.br "senha-forte"
 */
import { auth } from "../auth";
import { db } from ".";
import { member, organization } from "./schema";
import { criarUsuario } from "../usuarios/criar-usuario";
import { eq } from "drizzle-orm";

async function main() {
  const [nomeOrg, email, senha] = process.argv.slice(2);

  if (!nomeOrg || !email || !senha) {
    console.error(
      'Uso: npm run seed -- "<nome da organização>" <e-mail> <senha>',
    );
    process.exit(1);
  }

  const ctx = await auth.$context;
  const existente = await ctx.internalAdapter.findUserByEmail(email.trim().toLowerCase());
  const user = existente
    ? existente.user
    : await criarUsuario({
        name: email.split("@")[0] ?? email,
        email,
        password: senha,
      });

  const [vinculo] = await db
    .select({ memberId: member.id, organizationName: organization.name, role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, user.id))
    .limit(1);

  if (vinculo) {
    if (vinculo.role !== "owner") {
      await db.update(member).set({ role: "owner" }).where(eq(member.id, vinculo.memberId));
    }
    console.log(`Usuário utilizado: ${user.email}`);
    console.log(`Organização existente: ${vinculo.organizationName}`);
    console.log("Permissão atribuída: owner");
    process.exit(0);
  }

  const slug = nomeOrg
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const [orgExistente] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  if (orgExistente) {
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: orgExistente.id,
      userId: user.id,
      role: "owner",
      createdAt: new Date(),
    });
    console.log(`Usuário utilizado: ${user.email}`);
    console.log(`Organização existente: ${orgExistente.name}`);
    console.log("Permissão atribuída: owner");
    process.exit(0);
  }

  const org = await auth.api.createOrganization({
    body: {
      name: nomeOrg,
      slug,
      userId: user.id,
    },
  });

  console.log(`Usuário utilizado: ${user.email}`);
  console.log(`Organização criada: ${org?.name} (${org?.slug})`);
  console.log("Permissão atribuída: owner");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
