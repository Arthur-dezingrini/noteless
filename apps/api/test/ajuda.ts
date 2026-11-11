import { eq } from "drizzle-orm";

import { app } from "../src/app";
import { auth } from "../src/auth";
import { db } from "../src/db";
import { member, user } from "../src/db/schema";
import { criarUsuario } from "../src/modulos/conta";

const SENHA = "senha-de-teste-123";
const ORIGEM = "http://localhost:3000";

export type Pessoa = { id: string; email: string; cookie: string };

/** Entra como o navegador entraria e devolve o cookie de sessão. */
export async function entrar(email: string, senha = SENHA): Promise<string> {
  const res = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGEM },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!res.ok) throw new Error(`login falhou (${res.status}): ${await res.text()}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function pessoa(nome: string, email: string): Promise<Omit<Pessoa, "cookie">> {
  const u = await criarUsuario({ name: nome, email, password: SENHA });
  return { id: u.id, email: u.email };
}

/**
 * Uma fazenda com dono, administrador e membro, todos já logados. `sufixo`
 * separa e-mails quando o mesmo arquivo cria mais de uma organização.
 */
export async function criarFazenda(nome: string, sufixo = nome.toLowerCase().replace(/\W+/g, "")) {
  const dono = await pessoa("Dono", `dono@${sufixo}.test`);
  const org = await auth.api.createOrganization({ body: { name: nome, slug: sufixo, userId: dono.id } });
  if (!org) throw new Error("organização não criada");

  const vincular = async (nomePessoa: string, papel: "admin" | "member") => {
    const p = await pessoa(nomePessoa, `${papel}@${sufixo}.test`);
    await db.insert(member).values({ id: crypto.randomUUID(), organizationId: org.id, userId: p.id, role: papel, createdAt: new Date() });
    return p;
  };
  const admin = await vincular("Admin", "admin");
  const membro = await vincular("Membro", "member");

  const logado = async (p: Omit<Pessoa, "cookie">): Promise<Pessoa> => ({ ...p, cookie: await entrar(p.email) });
  return {
    orgId: org.id,
    dono: await logado(dono),
    admin: await logado(admin),
    membro: await logado(membro),
  };
}

let supers = 0;

/** Super usuário já logado (grava o tipo direto no Postgres em memória). */
export async function criarSuper(nome = "Super"): Promise<Pessoa> {
  supers += 1;
  const p = await pessoa(nome, `super${supers}@plataforma.test`);
  await db.update(user).set({ tipo: "super" }).where(eq(user.id, p.id));
  return { ...p, cookie: await entrar(p.email) };
}

/** Chamada à api como uma pessoa logada (ou anônima, sem `quem`). */
export async function chamar(quem: Pessoa | null, metodo: string, caminho: string, corpo?: unknown) {
  const res = await app.request(caminho, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGEM,
      ...(quem ? { Cookie: quem.cookie } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await res.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }
  // A resposta varia por rota; cada teste confere o que precisa.
  return { status: res.status, json: json as any };
}
