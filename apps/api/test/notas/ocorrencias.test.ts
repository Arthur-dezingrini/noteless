import type { Operacao } from "@vocare/shared";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "../../src/db";
import { notificacao } from "../../src/db/tabelas/avisos";
import { pesagem } from "../../src/db/tabelas/historico";
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
