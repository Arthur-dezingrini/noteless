import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { db } from "../../src/db";
import { ocorrencia } from "../../src/db/tabelas/notas";
import { nomeDoAudio } from "../../src/modulos/notas/regras/gravacao";
import { criarFazenda, type Pessoa } from "../ajuda";

// A IA fica de fora: o que está em teste é o arquivo que entra.
const ia = vi.hoisted(() => ({
  transcrever: vi.fn(async (_audio: File) => "Pesei a Mimosa."),
  analisar: vi.fn(async (_transcricao: string, _hoje: string) => ({ transcricao: null, resumo: "Pesagem.", operacoes: [] })),
}));
vi.mock("../../src/modulos/notas/ia/transcrever", async (original) => ({
  ...(await original<typeof import("../../src/modulos/notas/ia/transcrever")>()),
  transcrever: ia.transcrever,
}));
vi.mock("../../src/modulos/notas/ia/analisar", async (original) => ({
  ...(await original<typeof import("../../src/modulos/notas/ia/analisar")>()),
  analisar: ia.analisar,
}));

let f: Awaited<ReturnType<typeof criarFazenda>>;
let vizinha: Awaited<ReturnType<typeof criarFazenda>>;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
  vizinha = await criarFazenda("Boa Vista");
});
beforeEach(() => {
  ia.transcrever.mockClear();
  ia.analisar.mockClear();
});

/** WAV mono de 16 kHz: μ-law (1 byte por amostra) ou PCM de 16 bits. */
function wav(formato: "mulaw" | "pcm", dados: Uint8Array) {
  const bytes = formato === "mulaw" ? 1 : 2;
  const b = new Uint8Array(44 + dados.length);
  const v = new DataView(b.buffer);
  b.set([...Buffer.from("RIFFxxxxWAVEfmt ")], 0);
  v.setUint32(4, 36 + dados.length, true);
  v.setUint32(16, 16, true);
  v.setUint16(20, formato === "mulaw" ? 7 : 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 16000 * bytes, true);
  v.setUint16(32, bytes, true);
  v.setUint16(34, bytes * 8, true);
  b.set([...Buffer.from("data")], 36);
  v.setUint32(40, dados.length, true);
  b.set(dados, 44);
  return b;
}

/** Como a placa manda: o arquivo é o corpo da chamada, e os dados dele vão no endereço. */
async function enviarCru(quem: Pessoa | null, corpo: Uint8Array<ArrayBuffer> | string, tipo: string, campos: Record<string, string> = {}) {
  // Sem escapar os ":" da hora, como a placa manda.
  const dados = Object.entries(campos).map(([k, v]) => `${k}=${v}`).join("&");
  const res = await app.request(`/api/org/${f.orgId}/ocorrencias?${dados}`, {
    method: "POST",
    headers: { "Content-Type": tipo, ...(quem ? { Cookie: quem.cookie } : {}) },
    body: corpo,
  });
  return { status: res.status, json: (await res.json()) as { id: string; createdAt: string; duracaoSeg?: number | null; error?: string } };
}
const recebido = () => (ia.transcrever.mock.calls[0] as unknown as [File])[0];

describe("áudio cru no corpo", () => {
  it("vira nota, com a hora da gravação que veio no endereço e a duração do arquivo", async () => {
    const gravadoEm = new Date(Math.floor((Date.now() - 26 * 3600_000) / 1000) * 1000);
    const arquivo = wav("pcm", new Uint8Array(64000));
    const r = await enviarCru(f.membro, arquivo, "audio/wav", { gravadoEm: gravadoEm.toISOString(), duracaoSeg: "99" });

    expect(r.status).toBe(201);
    expect(new Date(r.json.createdAt).getTime()).toBe(gravadoEm.getTime());
    expect(r.json.duracaoSeg).toBe(2);
    expect(new Uint8Array(await recebido().arrayBuffer())).toEqual(arquivo);
  });

  it("chega na transcrição com a extensão certa, que é por onde ela reconhece o formato", async () => {
    await enviarCru(f.membro, wav("pcm", new Uint8Array(800)), "audio/wav");
    expect(recebido().name).toBe("gravacao.wav");
    expect(recebido().type).toBe("audio/wav");
  });

  it("μ-law vira PCM de 16 bits para a transcrição e para o player", async () => {
    const r = await enviarCru(f.membro, wav("mulaw", new Uint8Array([0xff, 0x80, 0x00, 0x7f])), "audio/wav");
    expect(r.status).toBe(201);

    const v = new DataView(await recebido().arrayBuffer());
    expect([v.getUint16(20, true), v.getUint16(34, true), v.getUint32(40, true)]).toEqual([1, 16, 8]);

    const res = await app.request(`/api/org/${f.orgId}/ocorrencias/${r.json.id}/audio`, { headers: { Cookie: f.admin.cookie } });
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect((await res.arrayBuffer()).byteLength).toBe(52);
  });

  it("2 min de gravação (1,9 MB), o máximo da placa, passam", async () => {
    const r = await enviarCru(f.membro, wav("mulaw", new Uint8Array(16000 * 120).fill(0x55)), "audio/wav");
    expect(r.status).toBe(201);
    expect(r.json.duracaoSeg).toBe(120);
  });

  it("o que não é WAV fica com a duração informada; sem nenhuma, fica sem", async () => {
    const webm = new Uint8Array(100);
    expect((await enviarCru(f.membro, webm, "audio/webm;codecs=opus", { duracaoSeg: "7" })).json.duracaoSeg).toBe(7);
    expect((await enviarCru(f.membro, webm, "audio/webm")).json.duracaoSeg).toBeNull();
  });

  it("corpo vazio 400, corpo que não é áudio 400, tipo de áudio malformado 415, e nada vai para a IA", async () => {
    expect((await enviarCru(f.membro, new Uint8Array(0), "audio/wav")).status).toBe(400);
    expect((await enviarCru(f.membro, new Uint8Array(800), "application/octet-stream")).status).toBe(400);
    expect((await enviarCru(f.membro, "<script>alert(1)</script>", "text/html")).status).toBe(400);
    expect((await enviarCru(f.membro, "<script>alert(1)</script>", "audio/wav; <script>")).status).toBe(415);
    expect(ia.transcrever).not.toHaveBeenCalled();
  });

  it("acima de 25 MB é recusado (413)", async () => {
    expect((await enviarCru(f.membro, new Uint8Array(25 * 1024 * 1024 + 1), "audio/wav")).status).toBe(413);
    expect(ia.transcrever).not.toHaveBeenCalled();
  });

  it("quem não é da fazenda não grava nela — nem o dono da vizinha, nem anônimo", async () => {
    const antes = await db.select({ id: ocorrencia.id }).from(ocorrencia).where(eq(ocorrencia.organizationId, f.orgId));
    const arquivo = wav("pcm", new Uint8Array(800));
    expect((await enviarCru(vizinha.dono, arquivo, "audio/wav")).status).toBe(403);
    expect((await enviarCru(null, arquivo, "audio/wav")).status).toBe(403);
    expect(ia.transcrever).not.toHaveBeenCalled();
    expect(await db.select({ id: ocorrencia.id }).from(ocorrencia).where(eq(ocorrencia.organizationId, f.orgId))).toHaveLength(antes.length);
  });
});

describe("nomeDoAudio", () => {
  it("dá a extensão do tipo, sem os parâmetros nem o x-", () => {
    expect(nomeDoAudio("audio/wav")).toBe("gravacao.wav");
    expect(nomeDoAudio("audio/x-wav")).toBe("gravacao.wav");
    expect(nomeDoAudio("audio/webm;codecs=opus")).toBe("gravacao.webm");
    expect(nomeDoAudio("audio/mpeg")).toBe("gravacao.mpeg");
  });
});
