import { describe, expect, it, vi } from "vitest";

import { enviarEmail } from "../../src/base/email";

const msg = { para: ["a@x.com"], assunto: "Assunto", texto: "Corpo" };
const comoFetch = (f: unknown) => f as typeof fetch;

describe("envio de e-mail pela Resend", () => {
  it("sem chave não chama a Resend", async () => {
    const f = vi.fn();
    expect(await enviarEmail(msg, { fetch: comoFetch(f) })).toEqual({ enviado: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("com chave manda remetente, destinatários e assunto", async () => {
    const f = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 200 }));
    const r = await enviarEmail(msg, { chave: "re_teste", remetente: "Noteless <avisos@noteless.com.br>", fetch: comoFetch(f) });
    expect(r).toEqual({ enviado: true });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_teste");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Noteless <avisos@noteless.com.br>",
      to: ["a@x.com"],
      subject: "Assunto",
      text: "Corpo",
    });
  });

  it("sem destinatário não envia", async () => {
    const f = vi.fn();
    expect(await enviarEmail({ ...msg, para: [] }, { chave: "re_teste", fetch: comoFetch(f) })).toEqual({ enviado: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("erro da Resend ou da rede não lança", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const recusa = vi.fn(async () => new Response('{"message":"inválido"}', { status: 422 }));
    expect(await enviarEmail(msg, { chave: "re_teste", fetch: comoFetch(recusa) })).toEqual({ enviado: false });
    const semRede = vi.fn(async () => {
      throw new Error("sem rede");
    });
    expect(await enviarEmail(msg, { chave: "re_teste", fetch: comoFetch(semRede) })).toEqual({ enviado: false });
  });
});
