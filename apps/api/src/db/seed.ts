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
import { criarUsuario } from "../usuarios/criar-usuario";

async function main() {
  const [nomeOrg, email, senha] = process.argv.slice(2);

  if (!nomeOrg || !email || !senha) {
    console.error(
      'Uso: npm run seed -- "<nome da organização>" <e-mail> <senha>',
    );
    process.exit(1);
  }

  const user = await criarUsuario({
    name: email.split("@")[0] ?? email,
    email,
    password: senha,
  });

  const org = await auth.api.createOrganization({
    body: {
      name: nomeOrg,
      slug: nomeOrg
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      userId: user.id,
    },
  });

  console.log(`Usuário criado: ${user.email}`);
  console.log(`Organização criada: ${org?.name} (${org?.slug})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
