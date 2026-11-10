import type { Operacao } from "@vocare/shared";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db } from "../src/db";
import { apontamentoAviario, pesagemLote, vacinacaoLote } from "../src/db/lotes";
import { ocorrencia } from "../src/db/ocorrencias";
import { hojeISO, noDia } from "../src/datas";
import { chamar, criarFazenda } from "./ajuda";

let f: Awaited<ReturnType<typeof criarFazenda>>;
let outra: Awaited<ReturnType<typeof criarFazenda>>;
let galpao3: string;
let galpao4: string;
let loteId: string;
let loteDeOutra: string;
const org = () => `/api/org/${f.orgId}`;
const hoje = hojeISO();

beforeAll(async () => {
  f = await criarFazenda("Granja Ocorrencias");
  outra = await criarFazenda("Granja Alheia");
  galpao3 = (await chamar(f.dono, "POST", `${org()}/instalacoes`, { nome: "Galpão 3", tipo: "galpao" })).json.id;
  galpao4 = (await chamar(f.dono, "POST", `${org()}/instalacoes`, { nome: "Galpão 4", tipo: "galpao" })).json.id;
  const l = await chamar(f.dono, "POST", `${org()}/lotes`, {
    codigo: "L-07", especie: "ave", dataAlojamento: "2026-01-05", galpoes: [{ instalacaoId: galpao3, femeas: 5000, machos: 500 }],
  });
  expect(l.status).toBe(201);
  loteId = l.json.id;
  const g = (await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/instalacoes`, { nome: "Galpão X", tipo: "galpao" })).json.id;
  const lo = await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/lotes`, {
    codigo: "L-X", especie: "ave", dataAlojamento: "2026-01-05", galpoes: [{ instalacaoId: g, femeas: 100, machos: 10 }],
  });
  loteDeOutra = lo.json.id;
});

const base = { titulo: "", detalhe: "", confianca: 90, trecho: "" };
const vazio = {
  mortasFemeas: null, mortasMachos: null, eliminadasFemeas: null, eliminadasMachos: null, ovosTotal: null,
  ovosIncubaveis: null, ovosTrincados: null, ovosSujos: null, ovosDuploGema: null, ovosDeformados: null,
  racaoKg: null, aguaL: null, temperaturaMax: null, temperaturaMin: null, observacoes: null,
};
const apontar = (instalacaoId: string, extra: Record<string, unknown>): Operacao =>
  ({ ...base, ...vazio, tipo: "apontar_galpao", alvo: "galpão", animalId: null, instalacaoId, data: null, ...extra }) as unknown as Operacao;

async function ocorrenciaDoMembro(operacoes: Operacao[], createdAt?: Date) {
  const [o] = await db
    .insert(ocorrencia)
    .values({ organizationId: f.orgId, criadoPorId: f.membro.id, transcricao: "Nota do dia.", resumo: "Nota.", operacoes, ...(createdAt ? { createdAt } : {}) })
    .returning({ id: ocorrencia.id });
  return o!.id;
}
const confirmar = (id: string, n: number, usuario = f.admin) =>
  chamar(usuario, "POST", `${org()}/ocorrencias/${id}/confirmar`, { operacoes: Array.from({ length: n }, (_, i) => i) });
const linhasDoDia = () => db.select().from(apontamentoAviario).where(eq(apontamentoAviario.instalacaoId, galpao3));

describe("confirmar operações do aviário", () => {
  it("apontamento cria a linha do dia com a ocorrência e uma segunda nota soma", async () => {
    const a = await ocorrenciaDoMembro([apontar(galpao3, { mortasFemeas: 12, ovosTotal: 8400 })]);
    expect((await confirmar(a, 1)).status).toBe(200);
    const b = await ocorrenciaDoMembro([apontar(galpao3, { mortasFemeas: 3 })]);
    expect((await confirmar(b, 1)).status).toBe(200);
    const linhas = await linhasDoDia();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ data: hoje, mortasFemeas: 15, ovosTotal: 8400, ocorrenciaId: a, loteId });
    await db.delete(apontamentoAviario).where(eq(apontamentoAviario.instalacaoId, galpao3));
  });

  it("dois apontamentos do mesmo galpão e dia na mesma nota somam", async () => {
    const id = await ocorrenciaDoMembro([apontar(galpao3, { ovosTotal: 4000 }), apontar(galpao3, { ovosTotal: 4400 })]);
    expect((await confirmar(id, 2)).status).toBe(200);
    const linhas = await linhasDoDia();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.ovosTotal).toBe(8400);
    await db.delete(apontamentoAviario).where(eq(apontamentoAviario.instalacaoId, galpao3));
  });

  it("galpão sem lote dá 400, nada é gravado e a ocorrência continua pendente", async () => {
    const id = await ocorrenciaDoMembro([apontar(galpao3, { ovosTotal: 100 }), apontar(galpao4, { ovosTotal: 100 })]);
    const r = await confirmar(id, 2);
    expect(r.status).toBe(400);
    expect(r.json.error).toContain("Galpão 4 não tem lote alojado");
    expect(await linhasDoDia()).toHaveLength(0);
    const [o] = await db.select({ status: ocorrencia.status }).from(ocorrencia).where(eq(ocorrencia.id, id));
    expect(o!.status).toBe("pendente");
  });

  it("pesagem e vacina gravam no lote certo; lote de outra organização dá 400", async () => {
    const id = await ocorrenciaDoMembro([
      { ...base, tipo: "pesar_lote", alvo: "L-07", animalId: null, loteId, data: null, sexo: "femea", pesoMedioG: 1850, uniformidadePct: 82, amostra: 50 },
      { ...base, tipo: "vacinar_lote", alvo: "L-07", animalId: null, loteId, vacina: "Newcastle", via: "ocular", data: null, proximaData: null },
    ] as unknown as Operacao[]);
    expect((await confirmar(id, 2)).status).toBe(200);
    const [p] = await db.select().from(pesagemLote).where(eq(pesagemLote.ocorrenciaId, id));
    expect(p).toMatchObject({ loteId, data: hoje, sexo: "femea" });
    expect(Number(p!.pesoMedioG)).toBe(1850);
    const [v] = await db.select().from(vacinacaoLote).where(eq(vacinacaoLote.ocorrenciaId, id));
    expect(v).toMatchObject({ loteId, vacina: "Newcastle", data: hoje });

    const alheio = await ocorrenciaDoMembro([
      { ...base, tipo: "pesar_lote", alvo: "L-X", animalId: null, loteId: loteDeOutra, data: null, sexo: "femea", pesoMedioG: 1800, uniformidadePct: null, amostra: null },
    ] as unknown as Operacao[]);
    const r = await confirmar(alheio, 1);
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Lote não encontrado nesta organização.");
  });

  it("nota gravada ontem com data null lança no dia da gravação, não no da confirmação", async () => {
    const ontem = noDia(hoje, -1);
    // Meio-dia em São Paulo (15h UTC) de ontem.
    const gravada = new Date(`${ontem}T15:00:00Z`);
    const id = await ocorrenciaDoMembro(
      [
        apontar(galpao3, { mortasFemeas: 4 }),
        { ...base, tipo: "pesar_lote", alvo: "L-07", animalId: null, loteId, data: null, sexo: "femea", pesoMedioG: 1700, uniformidadePct: null, amostra: null },
        { ...base, tipo: "vacinar_lote", alvo: "L-07", animalId: null, loteId, vacina: "Bouba", via: null, data: null, proximaData: null },
      ] as unknown as Operacao[],
      gravada,
    );
    expect((await confirmar(id, 3)).status).toBe(200);
    const linhas = await linhasDoDia();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ data: ontem, mortasFemeas: 4 });
    const [p] = await db.select().from(pesagemLote).where(eq(pesagemLote.ocorrenciaId, id));
    expect(p!.data).toBe(ontem);
    const [v] = await db.select().from(vacinacaoLote).where(eq(vacinacaoLote.ocorrenciaId, id));
    expect(v!.data).toBe(ontem);
    await db.delete(apontamentoAviario).where(eq(apontamentoAviario.instalacaoId, galpao3));
  });

  it("vacina do lote com data explícita no futuro dá 400 e nada é gravado", async () => {
    const id = await ocorrenciaDoMembro([
      { ...base, tipo: "vacinar_lote", alvo: "L-07", animalId: null, loteId, vacina: "Bouba", via: null, data: noDia(hoje, 1), proximaData: null },
    ] as unknown as Operacao[]);
    const r = await confirmar(id, 1);
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Data no futuro.");
    expect(await db.select().from(vacinacaoLote).where(eq(vacinacaoLote.ocorrenciaId, id))).toHaveLength(0);
  });

  it("membro não confirma operações do aviário", async () => {
    const id = await ocorrenciaDoMembro([apontar(galpao3, { ovosTotal: 100 })]);
    expect((await confirmar(id, 1, f.membro)).status).toBe(403);
  });
});
