import type { Operacao } from "@vocare/shared";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { db } from "../../src/db";
import { pesagem } from "../../src/db/tabelas/historico";
import { ocorrencia } from "../../src/db/tabelas/notas";
import { chamar, criarFazenda, type Pessoa } from "../ajuda";

// A IA fica de fora: o que está em teste é a data que ela recebe, não o que entende.
const ia = vi.hoisted(() => ({
  transcrever: vi.fn(async (_audio: File) => "Nasceu um bezerro da Mimosa hoje."),
  analisar: vi.fn(async (_transcricao: string, _hoje: string, ..._contexto: unknown[]) => ({
    transcricao: null as string | null,
    resumo: "Parto da Mimosa.",
    operacoes: [],
  })),
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
let mimosaId: string;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
  vizinha = await criarFazenda("Boa Vista");
  mimosaId = (await chamar(f.dono, "POST", `/api/org/${f.orgId}/animais`, { numero: "32", nome: "Mimosa", especie: "bovino" })).json.id;
});
beforeEach(() => ia.analisar.mockClear());

const H = 60 * 60 * 1000;
const diaEmSaoPaulo = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
/** Data "redonda" (sem milissegundos), como o gravador manda. */
const haHoras = (horas: number) => new Date(Math.floor((Date.now() - horas * H) / 1000) * 1000);

/** Manda um áudio como o gravador manda: multipart, com os campos opcionais. */
async function enviarAudio(quem: Pessoa | null, campos: Record<string, string> = {}, arquivo: Uint8Array = new Uint8Array(800)) {
  const form = new FormData();
  form.set("audio", new File([arquivo], "gravacao.wav", { type: "audio/wav" }));
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  const res = await app.request(`/api/org/${f.orgId}/ocorrencias`, {
    method: "POST",
    headers: quem ? { Cookie: quem.cookie } : {},
    body: form,
  });
  return { status: res.status, json: (await res.json()) as { id: string; createdAt: string; transcricao: string; transcricaoOriginal: string | null } };
}

describe("áudio gravado sem sinal e enviado depois", () => {
  it("fica com a hora e o dia em que foi gravado, e é esse o 'hoje' da IA", async () => {
    const gravadoEm = haHoras(26);
    expect(diaEmSaoPaulo(gravadoEm)).not.toBe(diaEmSaoPaulo(new Date()));

    const r = await enviarAudio(f.membro, { gravadoEm: gravadoEm.toISOString(), duracaoSeg: "4" });
    expect(r.status).toBe(201);
    expect(new Date(r.json.createdAt).getTime()).toBe(gravadoEm.getTime());
    expect(ia.analisar).toHaveBeenCalledWith(
      expect.any(String),
      diaEmSaoPaulo(gravadoEm),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      { produtos: [], locais: [] },
    );
  });

  it("sem a hora, ou com hora impossível, vale a hora da chegada — e a gravação não se perde", async () => {
    const hoje = diaEmSaoPaulo(new Date());
    const casos = [
      undefined,
      "ontem à tarde",
      new Date(Date.now() + 1 * H).toISOString(), // relógio da placa adiantado
      "1970-01-01T00:00:00Z", // relógio da placa nunca acertou
      haHoras(90 * 24).toISOString(), // velho demais para ser verdade
    ];
    for (const gravadoEm of casos) {
      ia.analisar.mockClear();
      const r = await enviarAudio(f.membro, gravadoEm ? { gravadoEm } : {});
      expect(r.status, String(gravadoEm)).toBe(201);
      expect(ia.analisar.mock.calls[0]?.[1], String(gravadoEm)).toBe(hoje);
      const criada = new Date(r.json.createdAt).getTime();
      if (gravadoEm && !Number.isNaN(Date.parse(gravadoEm))) expect(criada, gravadoEm).not.toBe(Date.parse(gravadoEm));
      // Perto de agora (com folga para o fuso do Postgres de teste).
      expect(Math.abs(criada - Date.now()), String(gravadoEm)).toBeLessThan(12 * H);
    }
  });

  it("reescrever o que foi dito usa o dia da gravação", async () => {
    const gravadaEm = haHoras(3 * 24);
    const [o] = await db
      .insert(ocorrencia)
      .values({ organizationId: f.orgId, criadoPorId: f.membro.id, transcricao: "", resumo: "", operacoes: [], createdAt: gravadaEm })
      .returning({ id: ocorrencia.id });

    const r = await chamar(f.membro, "POST", `/api/org/${f.orgId}/ocorrencias/${o!.id}/texto`, { texto: "A Mimosa pariu hoje." });
    expect(r.status).toBe(200);
    expect(ia.analisar.mock.calls[0]?.[1]).toBe(diaEmSaoPaulo(gravadaEm));
  });

  it("ação sem data, salva dias depois, fica no dia da gravação", async () => {
    const gravadaEm = haHoras(3 * 24);
    const pesar: Operacao = { titulo: "", detalhe: "", confianca: 90, trecho: "", tipo: "registrar_peso", alvo: "vaca 32", animalId: mimosaId, pesoKg: 480 };
    const [o] = await db
      .insert(ocorrencia)
      .values({ organizationId: f.orgId, criadoPorId: f.membro.id, transcricao: "A vaca 32 pesou 480.", resumo: "Pesagem.", operacoes: [pesar], createdAt: gravadaEm })
      .returning({ id: ocorrencia.id });

    expect((await chamar(f.admin, "POST", `/api/org/${f.orgId}/ocorrencias/${o!.id}/confirmar`, { operacoes: [0] })).status).toBe(200);
    const [p] = await db.select().from(pesagem).where(eq(pesagem.ocorrenciaId, o!.id));
    expect(p?.data).toBe(diaEmSaoPaulo(gravadaEm));
  });

  it("quem não é da fazenda não grava nela — nem o dono da vizinha, nem anônimo", async () => {
    ia.transcrever.mockClear();
    const gravadoEm = haHoras(2).toISOString();
    expect((await enviarAudio(vizinha.dono, { gravadoEm })).status).toBe(403);
    expect((await enviarAudio(null, { gravadoEm })).status).toBe(403);
    expect(ia.transcrever).not.toHaveBeenCalled();
  });
});

describe("transcrição corrigida pela IA", () => {
  it("a nota mostra o texto corrigido e guarda como o áudio foi ouvido", async () => {
    ia.transcrever.mockResolvedValueOnce("A parca 7 pariu 12 deitões.");
    ia.analisar.mockResolvedValueOnce({ transcricao: "A porca 7 pariu 12 leitões.", resumo: "Parto.", operacoes: [] });
    const r = await enviarAudio(f.membro);
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ transcricao: "A porca 7 pariu 12 leitões.", transcricaoOriginal: "A parca 7 pariu 12 deitões." });

    // Sem correção, só a do Whisper.
    const sem = await enviarAudio(f.membro);
    expect(sem.json).toMatchObject({ transcricao: "Nasceu um bezerro da Mimosa hoje.", transcricaoOriginal: null });
  });

  it("texto escrito por quem confere fica como foi escrito", async () => {
    const [o] = await db
      .insert(ocorrencia)
      .values({ organizationId: f.orgId, criadoPorId: f.membro.id, transcricao: "A porca", transcricaoOriginal: "A parca", resumo: "", operacoes: [] })
      .returning({ id: ocorrencia.id });
    ia.analisar.mockResolvedValueOnce({ transcricao: "A Mimosa pariu hoje.", resumo: "Parto.", operacoes: [] });
    const r = await chamar(f.membro, "POST", `/api/org/${f.orgId}/ocorrencias/${o!.id}/texto`, { texto: "A Mimoza pariu hoje." });
    expect(r.json).toMatchObject({ transcricao: "A Mimoza pariu hoje.", transcricaoOriginal: null });
  });
});

describe("vocabulário da transcrição", () => {
  it("leva os nomes do cadastro da fazenda, e não os da vizinha", async () => {
    await chamar(vizinha.dono, "POST", `/api/org/${vizinha.orgId}/animais`, { nome: "Trovoada", especie: "equino" });
    ia.transcrever.mockClear();
    expect((await enviarAudio(f.membro)).status).toBe(201);
    const [, vocab] = ia.transcrever.mock.calls[0] as unknown as [File, string];
    expect(vocab).toContain("Mimosa");
    expect(vocab).not.toContain("Trovoada");
  });
});

describe("áudio μ-law do gravador", () => {
  /** WAV μ-law de 16 kHz, como o gravador grava (metade do tamanho do PCM). */
  function wavMuLaw(amostras: number[]) {
    const b = new Uint8Array(44 + amostras.length);
    const v = new DataView(b.buffer);
    b.set([...Buffer.from("RIFFxxxxWAVEfmt ")], 0);
    v.setUint32(4, 36 + amostras.length, true);
    v.setUint32(16, 16, true);
    v.setUint16(20, 7, true); // μ-law
    v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true);
    v.setUint32(28, 16000, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    b.set([...Buffer.from("data")], 36);
    v.setUint32(40, amostras.length, true);
    b.set(amostras, 44);
    return b;
  }
  const formato = (b: Uint8Array) => {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { pcm: v.getUint16(20, true), bits: v.getUint16(34, true), taxa: v.getUint32(24, true), dados: v.getUint32(40, true) };
  };

  it("vira PCM de 16 bits para a transcrição e para o player da nota", async () => {
    ia.transcrever.mockClear();
    const r = await enviarAudio(f.membro, {}, wavMuLaw([0xff, 0x80, 0x00, 0x7f]));
    expect(r.status).toBe(201);

    const [recebido] = ia.transcrever.mock.calls[0] as unknown as [File];
    expect(formato(new Uint8Array(await recebido.arrayBuffer()))).toEqual({ pcm: 1, bits: 16, taxa: 16000, dados: 8 });

    const res = await app.request(`/api/org/${f.orgId}/ocorrencias/${r.json.id}/audio`, { headers: { Cookie: f.membro.cookie } });
    expect(res.status).toBe(200);
    const guardado = new Uint8Array(await res.arrayBuffer());
    expect(formato(guardado)).toEqual({ pcm: 1, bits: 16, taxa: 16000, dados: 8 });
    expect(new DataView(guardado.buffer).getInt16(46, true)).toBe(32124);
  });

  it("WAV PCM (gravador antigo) e outros formatos passam como vieram", async () => {
    ia.transcrever.mockClear();
    const pcm = new Uint8Array(800);
    await enviarAudio(f.membro, {}, pcm);
    const [recebido] = ia.transcrever.mock.calls[0] as unknown as [File];
    expect(new Uint8Array(await recebido.arrayBuffer())).toEqual(pcm);
  });
});
