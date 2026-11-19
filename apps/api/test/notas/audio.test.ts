import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { db } from "../../src/db";
import { ocorrencia, ocorrenciaAudio } from "../../src/db/tabelas/notas";
import { tipoDeAudio } from "../../src/modulos/notas/regras/gravacao";
import { criarFazenda, type Pessoa } from "../ajuda";

// A IA fica de fora: o que está em teste é o arquivo que entra e o que sai.
const ia = vi.hoisted(() => ({
  transcrever: vi.fn(async (_audio: File) => "Pesei a Mimosa."),
  analisar: vi.fn(async () => ({ transcricao: null, resumo: "Pesagem.", operacoes: [] })),
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

async function enviar(quem: Pessoa, arquivo: File, campos: Record<string, string> = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  form.set("audio", arquivo);
  const res = await app.request(`/api/org/${f.orgId}/ocorrencias`, { method: "POST", headers: { Cookie: quem.cookie }, body: form });
  return { status: res.status, json: (await res.json()) as { id: string; duracaoSeg?: number | null; error?: string } };
}

/** WAV PCM mono de 16 bits e 16 kHz, como o firmware anterior gravava. */
function wavPcm(segundos: number) {
  const dados = segundos * 32000;
  const b = new Uint8Array(44 + dados);
  const v = new DataView(b.buffer);
  b.set([...Buffer.from("RIFFxxxxWAVEfmt ")], 0);
  v.setUint32(4, 36 + dados, true);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  b.set([...Buffer.from("data")], 36);
  v.setUint32(40, dados, true);
  return b;
}

const ouvir = (quem: Pessoa, id: string) => app.request(`/api/org/${f.orgId}/ocorrencias/${id}/audio`, { headers: { Cookie: quem.cookie } });

describe("tipoDeAudio", () => {
  it("aceita áudio, com ou sem parâmetro; sem tipo vale webm", () => {
    expect(tipoDeAudio("audio/wav")).toBe("audio/wav");
    expect(tipoDeAudio("audio/webm;codecs=opus")).toBe("audio/webm;codecs=opus");
    expect(tipoDeAudio("Audio/MPEG")).toBe("audio/mpeg");
    expect(tipoDeAudio("")).toBe("audio/webm");
    expect(tipoDeAudio(null)).toBe("audio/webm");
  });

  it("recusa o que não é áudio", () => {
    for (const t of ["text/html", "image/svg+xml", "application/javascript", "audio/wav\r\nX-Injetado: 1", "audio/", "audio/wav; <script>"]) {
      expect(tipoDeAudio(t), t).toBeNull();
    }
  });
});

describe("arquivo da nota", () => {
  it("o que não é áudio é recusado (415) antes de ir para a IA", async () => {
    ia.transcrever.mockClear();
    const r = await enviar(f.membro, new File(["<script>alert(1)</script>"], "a.html", { type: "text/html" }));
    expect(r.status).toBe(415);
    expect(ia.transcrever).not.toHaveBeenCalled();
  });

  it("áudio do gravador entra e volta como áudio, sem o navegador adivinhar outro tipo", async () => {
    const r = await enviar(f.membro, new File([new Uint8Array(800)], "gravacao.wav", { type: "audio/wav" }));
    expect(r.status).toBe(201);

    const res = await ouvir(f.admin, r.json.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe("sandbox");
    expect((await res.arrayBuffer()).byteLength).toBe(800);
  });

  it("a duração de um WAV sai do arquivo, não do número que a placa mandou", async () => {
    // Gravação PCM que ficou na fila: o firmware μ-law conta 1 byte por amostra e manda o dobro.
    const r = await enviar(f.membro, new File([wavPcm(2)], "t1795017401335.wav", { type: "audio/wav" }), { duracaoSeg: "4" });
    expect(r.status).toBe(201);
    expect(r.json.duracaoSeg).toBe(2);
    const [o] = await db.select({ duracaoSeg: ocorrencia.duracaoSeg }).from(ocorrencia).where(eq(ocorrencia.id, r.json.id));
    expect(o?.duracaoSeg).toBe(2);
  });

  it("o que não é WAV (gravado no navegador) fica com a duração informada", async () => {
    const r = await enviar(f.membro, new File([new Uint8Array(100)], "nota.webm", { type: "audio/webm" }), { duracaoSeg: "7" });
    expect(r.status).toBe(201);
    expect(r.json.duracaoSeg).toBe(7);
  });

  it("tipo antigo fora do padrão, já guardado, sai como binário genérico", async () => {
    const r = await enviar(f.membro, new File([new Uint8Array(10)], "gravacao.wav", { type: "audio/wav" }));
    await db.update(ocorrenciaAudio).set({ mime: "text/html" }).where(eq(ocorrenciaAudio.ocorrenciaId, r.json.id));

    const res = await ouvir(f.membro, r.json.id);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-security-policy")).toBe("sandbox");
  });

  it("de outra fazenda não se ouve", async () => {
    const r = await enviar(f.membro, new File([new Uint8Array(10)], "gravacao.wav", { type: "audio/wav" }));
    const res = await app.request(`/api/org/${f.orgId}/ocorrencias/${r.json.id}/audio`, { headers: { Cookie: vizinha.dono.cookie } });
    expect(res.status).toBe(403);
    const [o] = await db.select({ id: ocorrencia.id }).from(ocorrencia).where(eq(ocorrencia.id, r.json.id));
    expect(o).toBeDefined();
  });
});
