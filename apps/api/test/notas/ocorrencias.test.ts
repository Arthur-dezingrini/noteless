import type { Operacao } from "@vocare/shared";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "../../src/db";
import { notificacao } from "../../src/db/tabelas/avisos";
import { parto as partoTabela, pesagem } from "../../src/db/tabelas/historico";
import { ocorrencia } from "../../src/db/tabelas/notas";
import { chamar, criarFazenda } from "../ajuda";

let f: Awaited<ReturnType<typeof criarFazenda>>;
let mimosaId: string;
const org = () => `/api/org/${f.orgId}`;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
  mimosaId = (await chamar(f.dono, "POST", `${org()}/animais`, { numero: "32", nome: "Mimosa", especie: "bovino", pesoKg: 462 })).json.id;
});

const base = { titulo: "", detalhe: "", confianca: 90, trecho: "" };

/**
 * Ocorrência como a IA deixaria: gravada pelo membro, para conferir. Entra
 * direto no banco — o que está em teste é a conferência, não a IA.
 */
async function ocorrenciaDoMembro(operacoes: Operacao[]) {
  const [o] = await db
    .insert(ocorrencia)
    .values({
      organizationId: f.orgId,
      criadoPorId: f.membro.id,
      transcricao: "A vaca 32 pesou 480 quilos e nasceu um bezerro, número 132.",
      resumo: "Pesagem e cadastro.",
      operacoes,
    })
    .returning({ id: ocorrencia.id });
  return o!.id;
}

const pesarMimosa: Operacao = { ...base, tipo: "registrar_peso", alvo: "vaca 32", animalId: null, pesoKg: 480 };
const bezerro: Operacao = { ...base, tipo: "cadastrar_animal", alvo: "bezerro 132", animalId: null, nome: "Bezerro 132", especie: "bovino", raca: null, sexo: null, nascimento: null };

describe("conferência de ocorrências", () => {
  it("membro confere, mas não salva nem descarta", async () => {
    const id = await ocorrenciaDoMembro([{ ...pesarMimosa, animalId: mimosaId }]);
    for (const acao of ["confirmar", "descartar"]) {
      const r = await chamar(f.membro, "POST", `${org()}/ocorrencias/${id}/${acao}`, { operacoes: [0] });
      expect(r.status, acao).toBe(403);
    }
    const encaminhada = await chamar(f.membro, "POST", `${org()}/ocorrencias/${id}/encaminhar`);
    expect(encaminhada.status).toBe(200);
  });

  it("salvar aplica só as ações marcadas, com a correção, e avisa quem gravou", async () => {
    // A IA não achou a vaca: quem confere escolhe a Mimosa e corrige o peso.
    const id = await ocorrenciaDoMembro([pesarMimosa, bezerro]);
    const r = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, {
      operacoes: [0],
      correcoes: { "0": { animalId: mimosaId, pesoKg: 478 } },
    });
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("confirmada");
    expect(r.json.revisadoPorNome).toBe("Admin");
    expect(r.json.operacoes[0]).toMatchObject({ aplicada: true, pesoKg: 478, original: { animalId: null, pesoKg: 480 } });
    expect(r.json.operacoes[1]).toMatchObject({ aplicada: false });

    // A pesagem entrou e o cadastro ficou com o peso novo…
    const pesagens = await db.select().from(pesagem).where(eq(pesagem.ocorrenciaId, id));
    expect(pesagens).toHaveLength(1);
    expect(Number(pesagens[0]!.pesoKg)).toBe(478);
    const animais = (await chamar(f.admin, "GET", `${org()}/animais`)).json as { id: string; nome: string; pesoKg: number }[];
    expect(animais.find((a) => a.id === mimosaId)?.pesoKg).toBe(478);
    // …e o bezerro, que ficou desmarcado, não foi cadastrado.
    expect(animais.map((a) => a.nome)).not.toContain("Bezerro 132");

    const avisos = await db
      .select()
      .from(notificacao)
      .where(and(eq(notificacao.userId, f.membro.id), eq(notificacao.link, `/notas?id=${id}`)));
    expect(avisos).toEqual([expect.objectContaining({ texto: "Sua nota foi salva" })]);
  });

  it("ação sem animal não salva, e nada entra no sistema (tudo ou nada)", async () => {
    const id = await ocorrenciaDoMembro([bezerro, pesarMimosa]);
    const r = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0, 1] });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Operação sem animal do cadastro não pode ser aplicada.");

    // O cadastro do bezerro, que vinha antes, foi desfeito junto.
    const animais = (await chamar(f.admin, "GET", `${org()}/animais`)).json as { nome: string }[];
    expect(animais.map((a) => a.nome)).not.toContain("Bezerro 132");
    const [o] = await db.select({ status: ocorrencia.status }).from(ocorrencia).where(eq(ocorrencia.id, id));
    expect(o!.status).toBe("pendente");
  });

  it("animal novo sem nome não é cadastrado; com o nome escrito por quem confere, é", async () => {
    const semNome: Operacao = { ...bezerro, alvo: "um bezerro novo", nome: "" };
    const id = await ocorrenciaDoMembro([semNome]);
    const r = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0] });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Informe o nome do animal.");

    const ok = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0], correcoes: { "0": { nome: "Bezerro 140" } } });
    expect(ok.status).toBe(200);
    expect(ok.json.operacoes[0]).toMatchObject({ aplicada: true, nome: "Bezerro 140", original: { nome: "" } });
    const animais = (await chamar(f.admin, "GET", `${org()}/animais`)).json as { nome: string }[];
    expect(animais.map((a) => a.nome)).toContain("Bezerro 140");
  });

  it("parto salvo cadastra as crias com os dados da mãe e as junta num grupo", async () => {
    const porca = (await chamar(f.dono, "POST", `${org()}/animais`, { nome: "Porca 7", especie: "suino", raca: "Landrace", local: "Maternidade" })).json.id;
    const parto: Operacao = {
      ...base,
      tipo: "registrar_parto",
      alvo: "porca 7",
      animalId: porca,
      data: "2026-11-15",
      crias: 3,
      observacoes: null,
      cadastrarCrias: true,
      nomesCrias: "Faísca",
      paiId: null,
      paiExterno: "sêmen Duroc",
    };
    const id = await ocorrenciaDoMembro([parto]);
    expect((await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0] })).status).toBe(200);

    const animais = (await chamar(f.admin, "GET", `${org()}/animais`)).json as { id: string; nome: string; maeId: string }[];
    const crias = animais.filter((a) => ["Faísca", "Cria 2 da Porca 7", "Cria 3 da Porca 7"].includes(a.nome));
    expect(crias).toHaveLength(3);
    for (const c of crias) {
      expect(c).toMatchObject({ especie: "suino", raca: "Landrace", local: "Maternidade", nascimento: "2026-11-15", maeId: porca, paiId: null, paiExterno: "sêmen Duroc" });
    }
    const grupos = (await chamar(f.admin, "GET", `${org()}/grupos`)).json as { nome: string; animalIds: string[] }[];
    const grupo = grupos.find((g) => g.nome === "Crias da Porca 7 · 15/11");
    expect(grupo?.animalIds.sort()).toEqual(crias.map((c) => c.id).sort());
  });

  it("com o cadastro das crias desligado por quem confere, só o parto entra", async () => {
    const vaca = (await chamar(f.dono, "POST", `${org()}/animais`, { nome: "Estrela", especie: "bovino" })).json.id;
    const parto: Operacao = { ...base, tipo: "registrar_parto", alvo: "Estrela", animalId: vaca, data: null, crias: 1, observacoes: null, cadastrarCrias: true, nomesCrias: null, paiId: null, paiExterno: null };
    const id = await ocorrenciaDoMembro([parto]);
    const r = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0], correcoes: { "0": { cadastrarCrias: false } } });
    expect(r.status).toBe(200);
    const animais = (await chamar(f.admin, "GET", `${org()}/animais`)).json as { nome: string }[];
    expect(animais.map((a) => a.nome)).not.toContain("Cria da Estrela");
    const [p] = await db.select().from(partoTabela).where(eq(partoTabela.ocorrenciaId, id));
    expect(p).toMatchObject({ animalId: vaca, crias: 1 });
  });

  it("o pai dito fica no parto e nas crias; pai de outra fazenda não salva", async () => {
    const mae = (await chamar(f.dono, "POST", `${org()}/animais`, { nome: "Porca 9", especie: "suino" })).json.id;
    const cachaco = (await chamar(f.dono, "POST", `${org()}/animais`, { nome: "Cachaço 12", especie: "suino", sexo: "macho" })).json.id;
    const parto: Operacao = { ...base, tipo: "registrar_parto", alvo: "porca 9", animalId: mae, data: null, crias: 2, observacoes: null, cadastrarCrias: true, nomesCrias: null, paiId: cachaco, paiExterno: null };

    const vizinha = await criarFazenda("Vizinha do cachaço");
    const alheio = (await chamar(vizinha.dono, "POST", `/api/org/${vizinha.orgId}/animais`, { nome: "Alheio", especie: "suino" })).json.id;
    const recusado = await ocorrenciaDoMembro([{ ...parto, paiId: alheio }]);
    const r = await chamar(f.admin, "POST", `${org()}/ocorrencias/${recusado}/confirmar`, { operacoes: [0] });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Pai não encontrado nesta organização.");

    const id = await ocorrenciaDoMembro([parto]);
    expect((await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0] })).status).toBe(200);
    const [p] = await db.select().from(partoTabela).where(eq(partoTabela.ocorrenciaId, id));
    expect(p).toMatchObject({ paiId: cachaco, paiExterno: null });
    const ficha = (await chamar(f.admin, "GET", `${org()}/animais/${cachaco}/ficha`)).json as { filhos: { rotulo: string }[] };
    expect(ficha.filhos.map((x) => x.rotulo).sort()).toEqual(["Cria 1 da Porca 9", "Cria 2 da Porca 9"]);

    // O parto seguinte da mesma mãe continua a conta, sem repetir nome.
    const outro = await ocorrenciaDoMembro([{ ...parto, paiId: null, crias: 1 }]);
    expect((await chamar(f.admin, "POST", `${org()}/ocorrencias/${outro}/confirmar`, { operacoes: [0] })).status).toBe(200);
    const daMae = (await chamar(f.admin, "GET", `${org()}/animais/${mae}/ficha`)).json as { filhos: { rotulo: string }[] };
    expect(daMae.filhos.map((x) => x.rotulo).sort()).toEqual(["Cria 1 da Porca 9", "Cria 2 da Porca 9", "Cria 3 da Porca 9"]);
  });

  it("parto na mãe de outra fazenda não salva nem cadastra cria nenhuma", async () => {
    const vizinha = await criarFazenda("Vizinha do parto");
    const alheia = (await chamar(vizinha.dono, "POST", `/api/org/${vizinha.orgId}/animais`, { nome: "Alheia", especie: "bovino" })).json.id;
    const parto: Operacao = { ...base, tipo: "registrar_parto", alvo: "Alheia", animalId: alheia, data: null, crias: 2, observacoes: null, cadastrarCrias: true, nomesCrias: null, paiId: null, paiExterno: null };
    const id = await ocorrenciaDoMembro([parto]);
    const r = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0] });
    expect(r.status).toBe(400);
    const nossos = (await chamar(f.admin, "GET", `${org()}/animais`)).json as { nome: string }[];
    const deles = (await chamar(vizinha.dono, "GET", `/api/org/${vizinha.orgId}/animais`)).json as { nome: string }[];
    expect([...nossos, ...deles].map((a) => a.nome).filter((n) => n.includes("Alheia") && n !== "Alheia")).toEqual([]);
  });

  it("correção inválida volta dizendo qual ação", async () => {
    const id = await ocorrenciaDoMembro([{ ...pesarMimosa, animalId: mimosaId }]);
    const r = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0], correcoes: { "0": { pesoKg: -1 } } });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("O peso precisa ser maior que zero. (ação 1)");
  });

  it("não salva duas vezes", async () => {
    const id = await ocorrenciaDoMembro([{ ...pesarMimosa, animalId: mimosaId }]);
    expect((await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0] })).status).toBe(200);
    const deNovo = await chamar(f.admin, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: [0] });
    expect(deNovo.status).toBe(409);
  });

  it("descartar e voltar para conferir", async () => {
    const id = await ocorrenciaDoMembro([{ ...pesarMimosa, animalId: mimosaId }]);
    const descartada = await chamar(f.dono, "POST", `${org()}/ocorrencias/${id}/descartar`);
    expect(descartada.json.status).toBe("descartada");

    const restaurada = await chamar(f.dono, "POST", `${org()}/ocorrencias/${id}/restaurar`);
    expect(restaurada.status).toBe(200);
    expect(restaurada.json.status).toBe("pendente");
  });

  it("sem chave da IA, mandar áudio avisa o que falta em vez de quebrar", async () => {
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array(100)], { type: "audio/webm" }), "a.webm");
    const { app } = await import("../../src/app");
    const res = await app.request(`${org()}/ocorrencias`, {
      method: "POST",
      headers: { Cookie: f.membro.cookie, Origin: "http://localhost:3000" },
      body: form,
    });
    expect(res.status).toBe(503);
  });
});
