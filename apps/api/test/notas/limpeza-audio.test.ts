import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { db } from "../../src/db";
import { ocorrencia, ocorrenciaAudio } from "../../src/db/tabelas/notas";
import { env } from "../../src/env";
import { buscar } from "../../src/modulos/notas/consultas";
import { apagarAudiosVencidos } from "../../src/modulos/notas/regras/limpeza-audio";
import { criarFazenda } from "../ajuda";

const agora = new Date("2026-11-16T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);

let f: Awaited<ReturnType<typeof criarFazenda>>;
let vizinha: Awaited<ReturnType<typeof criarFazenda>>;

beforeAll(async () => {
  f = await criarFazenda("Limpeza Audio");
  vizinha = await criarFazenda("Limpeza Vizinha");
});

/** Nota gravada direto no banco, revisada em `revisadoEm`, com ou sem o áudio guardado. */
async function nota(orgId: string, status: "pendente" | "confirmada" | "descartada", revisadoEm: Date | null, comAudio = true) {
  const [n] = await db
    .insert(ocorrencia)
    .values({ organizationId: orgId, status, transcricao: "Duas aves mortas no galpão 1.", resumo: "", operacoes: [], revisadoEm, createdAt: revisadoEm ?? diasAtras(200) })
    .returning({ id: ocorrencia.id });
  if (comAudio) await db.insert(ocorrenciaAudio).values({ ocorrenciaId: n!.id, mime: "audio/wav", dados: Buffer.from([1, 2, 3]) });
  return n!.id;
}
const temAudio = async (id: string) => (await db.select().from(ocorrenciaAudio).where(eq(ocorrenciaAudio.ocorrenciaId, id))).length > 0;
const apagadoEm = async (id: string) =>
  (await db.select({ em: ocorrencia.audioApagadoEm }).from(ocorrencia).where(eq(ocorrencia.id, id)))[0]!.em;

describe("áudio apagado 90 dias depois da revisão", () => {
  it("apaga o áudio de nota confirmada há 91 dias e marca a data", async () => {
    const id = await nota(f.orgId, "confirmada", diasAtras(91));
    await apagarAudiosVencidos(agora);
    expect(await temAudio(id)).toBe(false);
    expect(await apagadoEm(id)).toEqual(agora);
  });

  it("mantém o áudio de nota confirmada há 89 dias", async () => {
    const id = await nota(f.orgId, "confirmada", diasAtras(89));
    await apagarAudiosVencidos(agora);
    expect(await temAudio(id)).toBe(true);
    expect(await apagadoEm(id)).toBeNull();
  });

  it("apaga o áudio de nota descartada há 91 dias", async () => {
    const id = await nota(f.orgId, "descartada", diasAtras(91));
    await apagarAudiosVencidos(agora);
    expect(await temAudio(id)).toBe(false);
  });

  it("não toca em nota pendente, nem antiga nem restaurada", async () => {
    const restaurada = await nota(f.orgId, "pendente", null);
    const pendenteAntiga = await nota(f.orgId, "pendente", diasAtras(91));
    await apagarAudiosVencidos(agora);
    expect(await temAudio(restaurada)).toBe(true);
    expect(await temAudio(pendenteAntiga)).toBe(true);
  });

  it("nota sem áudio não ganha data de áudio apagado", async () => {
    const id = await nota(f.orgId, "confirmada", diasAtras(91), false);
    await apagarAudiosVencidos(agora);
    expect(await apagadoEm(id)).toBeNull();
  });

  it("vale para todas as empresas", async () => {
    const daqui = await nota(f.orgId, "confirmada", diasAtras(120));
    const dali = await nota(vizinha.orgId, "confirmada", diasAtras(120));
    await apagarAudiosVencidos(agora);
    expect(await temAudio(daqui)).toBe(false);
    expect(await temAudio(dali)).toBe(false);
  });

  it("apaga no máximo o limite por chamada e diz quantos apagou", async () => {
    await nota(f.orgId, "confirmada", diasAtras(95));
    await nota(f.orgId, "confirmada", diasAtras(95));
    expect(await apagarAudiosVencidos(agora, 1)).toBe(1);
    expect(await apagarAudiosVencidos(agora)).toBe(1);
  });

  it("a nota mostra quando o áudio foi apagado", async () => {
    const id = await nota(f.orgId, "confirmada", diasAtras(100));
    await apagarAudiosVencidos(agora);
    const [n] = await buscar(f.orgId, id);
    expect(n!.temAudio).toBe(false);
    expect(n!.audioApagadoEm).toEqual(agora);
  });
});

describe("rota da rotina de limpeza", () => {
  const SEGREDO = "s".repeat(64);
  const limpar = (autorizacao?: string) =>
    app.request("/api/rotinas/limpeza-audio", { method: "POST", headers: autorizacao ? { Authorization: autorizacao } : {} });

  afterEach(() => {
    env.ROTINAS_SEGREDO = undefined;
  });

  it("sem ROTINAS_SEGREDO configurado responde 503", async () => {
    expect((await limpar(`Bearer ${SEGREDO}`)).status).toBe(503);
  });

  it("sem segredo ou com segredo errado responde 401", async () => {
    env.ROTINAS_SEGREDO = SEGREDO;
    expect((await limpar()).status).toBe(401);
    expect((await limpar("Bearer errado")).status).toBe(401);
  });

  it("com o segredo certo responde 200 com quantos apagou", async () => {
    env.ROTINAS_SEGREDO = SEGREDO;
    const r = await limpar(`Bearer ${SEGREDO}`);
    expect(r.status).toBe(200);
    expect(typeof ((await r.json()) as { apagados: unknown }).apagados).toBe("number");
  });
});
