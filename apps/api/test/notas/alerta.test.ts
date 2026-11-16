import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { alertar } from "../../src/base/alerta";
import { IaNaoConfigurada } from "../../src/modulos/notas/ia/transcrever";
import { chamar, criarFazenda } from "../ajuda";

// A IA fica de fora: o que está em teste é o aviso quando ela falha.
const ia = vi.hoisted(() => ({
  transcrever: vi.fn(async (_audio: File) => "Morreram duas aves no galpão 1."),
  analisar: vi.fn(async (_transcricao: string, _hoje: string, ..._contexto: unknown[]) => ({
    transcricao: null as string | null,
    resumo: "Mortalidade no galpão 1.",
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
vi.mock("../../src/base/alerta", async (original) => ({
  ...(await original<typeof import("../../src/base/alerta")>()),
  alertar: vi.fn(async () => ({ enviado: true })),
}));

let f: Awaited<ReturnType<typeof criarFazenda>>;

beforeAll(async () => {
  f = await criarFazenda("Alerta Notas");
});
beforeEach(() => {
  vi.mocked(alertar).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** Manda um áudio como o gravador manda (multipart). */
async function enviarAudio() {
  const form = new FormData();
  form.set("audio", new File([new Uint8Array(800)], "gravacao.wav", { type: "audio/wav" }));
  const res = await app.request(`/api/org/${f.orgId}/ocorrencias`, {
    method: "POST",
    headers: { Cookie: f.dono.cookie },
    body: form,
  });
  return { status: res.status, json: (await res.json()) as { id: string } };
}

describe("falhas da IA nas notas avisam por e-mail", () => {
  it("transcrição que falha responde 502 e alerta pipeline-audio", async () => {
    ia.transcrever.mockRejectedValueOnce(new Error("groq fora"));
    const r = await enviarAudio();
    expect(r.status).toBe(502);
    expect(alertar).toHaveBeenCalledWith("pipeline-audio", expect.objectContaining({ mensagem: "groq fora", orgId: f.orgId }));
  });

  it("IA não configurada responde 503 e não alerta", async () => {
    ia.transcrever.mockRejectedValueOnce(new IaNaoConfigurada("A transcrição"));
    const r = await enviarAudio();
    expect(r.status).toBe(503);
    expect(alertar).not.toHaveBeenCalled();
  });

  it("texto que a IA não interpreta responde 502 e alerta interpretar-texto", async () => {
    const nota = await enviarAudio();
    expect(nota.status).toBe(201);
    ia.analisar.mockRejectedValueOnce(new Error("ia fora"));
    const r = await chamar(f.dono, "POST", `/api/org/${f.orgId}/ocorrencias/${nota.json.id}/texto`, {
      texto: "Morreram três aves no galpão 2.",
    });
    expect(r.status).toBe(502);
    expect(alertar).toHaveBeenCalledWith("interpretar-texto", expect.objectContaining({ mensagem: "ia fora", orgId: f.orgId }));
  });
});
