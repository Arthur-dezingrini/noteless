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

async function enviar(quem: Pessoa, arquivo: File) {
  const form = new FormData();
  form.set("audio", arquivo);
  const res = await app.request(`/api/org/${f.orgId}/ocorrencias`, { method: "POST", headers: { Cookie: quem.cookie }, body: form });
  return { status: res.status, json: (await res.json()) as { id: string; error?: string } };
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
