import type { Operacao } from "@vocare/shared";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../src/app";
import { db } from "../src/db";
import { pesagem } from "../src/db/historico";
import { ocorrencia } from "../src/db/ocorrencias";
import { chamar, criarFazenda, type Pessoa } from "./ajuda";

// A IA fica de fora: o que está em teste é a data que ela recebe, não o que entende.
const ia = vi.hoisted(() => ({
  transcrever: vi.fn(async (_audio: File) => "Nasceu um bezerro da Mimosa hoje."),
  analisar: vi.fn(async (_transcricao: string, _hoje: string, ..._contexto: unknown[]) => ({ resumo: "Parto da Mimosa.", operacoes: [] })),
}));
vi.mock("../src/ia/transcrever", async (original) => ({
  ...(await original<typeof import("../src/ia/transcrever")>()),
  transcrever: ia.transcrever,
}));
vi.mock("../src/ia/analisar", async (original) => ({
  ...(await original<typeof import("../src/ia/analisar")>()),
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
async function enviarAudio(quem: Pessoa | null, campos: Record<string, string> = {}) {
  const form = new FormData();
  form.set("audio", new File([new Uint8Array(800)], "gravacao.wav", { type: "audio/wav" }));
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  const res = await app.request(`/api/org/${f.orgId}/ocorrencias`, {
    method: "POST",
    headers: quem ? { Cookie: quem.cookie } : {},
    body: form,
  });
  return { status: res.status, json: (await res.json()) as { id: string; createdAt: string } };
}

describe("áudio gravado sem sinal e enviado depois", () => {
  it("fica com a hora e o dia em que foi gravado, e é esse o 'hoje' da IA", async () => {
    const gravadoEm = haHoras(26);
    expect(diaEmSaoPaulo(gravadoEm)).not.toBe(diaEmSaoPaulo(new Date()));

    const r = await enviarAudio(f.membro, { gravadoEm: gravadoEm.toISOString(), duracaoSeg: "4" });
    expect(r.status).toBe(201);
    expect(new Date(r.json.createdAt).getTime()).toBe(gravadoEm.getTime());
    expect(ia.analisar).toHaveBeenCalledWith(expect.any(String), diaEmSaoPaulo(gravadoEm), expect.anything(), expect.anything());
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
