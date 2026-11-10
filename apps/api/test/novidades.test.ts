import { novidadesSchema } from "@vocare/shared";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "../src/db";
import { notificacao } from "../src/db/historico";
import { ocorrencia } from "../src/db/ocorrencias";
import { chamar, criarFazenda, type Pessoa } from "./ajuda";

let f: Awaited<ReturnType<typeof criarFazenda>>;
let vizinha: Awaited<ReturnType<typeof criarFazenda>>;
const org = () => `/api/org/${f.orgId}`;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
  vizinha = await criarFazenda("Boa Vista");
});

async function versao(quem: Pessoa) {
  const r = await chamar(quem, "GET", `${org()}/novidades`);
  expect(r.status).toBe(200);
  return novidadesSchema.parse(r.json).versao;
}

/** Como o gravador deixaria: transcrita, interpretada, esperando conferência. */
async function chegaOcorrencia() {
  const [o] = await db
    .insert(ocorrencia)
    .values({ organizationId: f.orgId, criadoPorId: f.membro.id, transcricao: "Nasceu um bezerro da Mimosa.", resumo: "Parto.", operacoes: [] })
    .returning({ id: ocorrencia.id });
  return o!.id;
}

describe("novidades: a tela aberta se atualiza sozinha", () => {
  it("fica igual enquanto nada muda", async () => {
    expect(await versao(f.dono)).toBe(await versao(f.dono));
  });

  it("muda para todo mundo da fazenda quando chega ocorrência", async () => {
    const antes = await Promise.all([versao(f.dono), versao(f.admin), versao(f.membro)]);
    await chegaOcorrencia();
    const depois = await Promise.all([versao(f.dono), versao(f.admin), versao(f.membro)]);
    depois.forEach((v, i) => expect(v).not.toBe(antes[i]));
  });

  it("muda quando a ocorrência anda — mesmo para quem não recebe aviso disso", async () => {
    const id = await chegaOcorrencia();
    // Quem observa é sempre alguém que não ganha notificação pela ação:
    // a versão tem que mudar pela ocorrência em si.
    const passos = [
      { quem: f.membro, acao: "encaminhar", observa: f.membro },
      { quem: f.admin, acao: "descartar", observa: f.dono },
      { quem: f.admin, acao: "restaurar", observa: f.dono },
    ];
    for (const { quem, acao, observa } of passos) {
      const antes = await versao(observa);
      const r = await chamar(quem, "POST", `${org()}/ocorrencias/${id}/${acao}`);
      expect(r.status, acao).toBe(200);
      expect(await versao(observa), acao).not.toBe(antes);
    }

    // Reescrever o que foi dito (a rota chama a IA; aqui, direto no banco).
    const antes = await versao(f.dono);
    await db.update(ocorrencia).set({ transcricao: "Nasceram dois bezerros da Mimosa." }).where(eq(ocorrencia.id, id));
    expect(await versao(f.dono)).not.toBe(antes);
  });

  it("aviso novo ou lido muda só a versão de quem recebeu", async () => {
    const antes = { dono: await versao(f.dono), membro: await versao(f.membro) };
    await db.insert(notificacao).values({ organizationId: f.orgId, userId: f.dono.id, texto: "Nova ocorrência para conferir" });
    const comAviso = await versao(f.dono);
    expect(comAviso).not.toBe(antes.dono);
    expect(await versao(f.membro)).toBe(antes.membro);

    expect((await chamar(f.dono, "POST", `${org()}/notificacoes/lidas`)).status).toBe(200);
    expect(await versao(f.dono)).not.toBe(comAviso);
  });

  it("quem não é da fazenda não pergunta — nem o dono da vizinha, nem anônimo", async () => {
    expect((await chamar(vizinha.dono, "GET", `${org()}/novidades`)).status).toBe(403);
    expect((await chamar(null, "GET", `${org()}/novidades`)).status).toBe(403);
  });
});
