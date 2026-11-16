import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it, vi } from "vitest";

import { criarAlerta, criarLimitador, JANELA_ALERTA_MS, mensagemDe, orgDaRota } from "../../src/base/alerta";
import type { Email } from "../../src/base/email";

/** 16/11/2026 15:00 UTC = 12:00 em Brasília. */
const quando = () => Date.UTC(2026, 10, 16, 15, 0, 0);
const enviou = () => vi.fn(async (_e: Email) => ({ enviado: true }));

describe("limite de alertas", () => {
  it("o mesmo tipo sai uma vez a cada 15 min; outro tipo sai na hora", () => {
    let t = 0;
    const pode = criarLimitador(JANELA_ALERTA_MS, () => t);
    expect(pode("a")).toBe(true);
    expect(pode("a")).toBe(false);
    expect(pode("b")).toBe(true);
    t = JANELA_ALERTA_MS - 1;
    expect(pode("a")).toBe(false);
    t = JANELA_ALERTA_MS;
    expect(pode("a")).toBe(true);
  });
});

describe("alerta por e-mail", () => {
  it("monta o e-mail com tipo, hora de Brasília, rota, empresa e erro cortado em 500", async () => {
    const enviar = enviou();
    const alertar = criarAlerta({ enviar, destinatarios: ["a@x.com"], ambiente: "prod", agora: quando });
    const r = await alertar("pipeline-audio", { mensagem: "x".repeat(800), rota: "POST /api/org/o1/ocorrencias", orgId: "o1" });
    expect(r).toEqual({ enviado: true });
    const e = enviar.mock.calls[0]![0];
    expect(e.para).toEqual(["a@x.com"]);
    expect(e.assunto).toBe("[Noteless prod] pipeline-audio");
    expect(e.texto).toContain("16/11/2026");
    expect(e.texto).toContain("12:00");
    expect(e.texto).toContain("Rota: POST /api/org/o1/ocorrencias");
    expect(e.texto).toContain("Empresa: o1");
    expect(e.texto).toContain("x".repeat(500));
    expect(e.texto).not.toContain("x".repeat(501));
  });

  it("segundo alerta do mesmo tipo em 15 min não sai", async () => {
    const enviar = enviou();
    const alertar = criarAlerta({ enviar, destinatarios: ["a@x.com"], ambiente: "prod", agora: quando });
    await alertar("erro-api", { mensagem: "um" });
    expect(await alertar("erro-api", { mensagem: "dois" })).toEqual({ enviado: false });
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("sem destinatários não chama o envio", async () => {
    const enviar = enviou();
    const alertar = criarAlerta({ enviar, destinatarios: [], ambiente: "prod", agora: quando });
    expect(await alertar("erro-api", { mensagem: "x" })).toEqual({ enviado: false });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("envio que lança não lança", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const enviar = vi.fn(async (_e: Email): Promise<{ enviado: boolean }> => {
      throw new Error("caiu");
    });
    const alertar = criarAlerta({ enviar, destinatarios: ["a@x.com"], ambiente: "prod", agora: quando });
    await expect(alertar("erro-api", { mensagem: "x" })).resolves.toEqual({ enviado: false });
  });
});

describe("pedaços do alerta", () => {
  it("tira o id da empresa do caminho", () => {
    expect(orgDaRota("/api/org/abc-123/ocorrencias")).toBe("abc-123");
    expect(orgDaRota("/api/perfil")).toBeUndefined();
  });

  it("descreve qualquer coisa que foi lançada", () => {
    expect(mensagemDe(new Error("quebrou"))).toBe("quebrou");
    expect(mensagemDe("texto solto")).toBe("texto solto");
  });

  it("erro de banco não leva os valores da consulta (transcrição, resumo, áudio)", () => {
    const sql = 'update "ocorrencia" set "transcricao" = $1, "resumo" = $2';
    const e = new DrizzleQueryError(sql, ["Morreram duas aves no galpão 1", "Mortalidade de 2 aves"], new Error("Connection terminated unexpectedly"));
    expect(mensagemDe(e)).toBe("Connection terminated unexpectedly");
    expect(mensagemDe(new DrizzleQueryError(sql, ["Morreram duas aves no galpão 1"]))).toBe("Falha numa consulta ao banco.");
  });
});
