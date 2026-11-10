import { describe, expect, it } from "vitest";

import { AO_VIVO, proximaVerificacao, voltouDaOciosidade } from "./ao-vivo";

const MIN = 60_000;

describe("proximaVerificacao", () => {
  it("com a aba escondida não pergunta nada", () => {
    expect(proximaVerificacao(false, 0)).toBeNull();
    expect(proximaVerificacao(false, 60 * MIN)).toBeNull();
  });

  it("com alguém mexendo, pergunta de 5 em 5 segundos", () => {
    expect(proximaVerificacao(true, 0)).toBe(5_000);
    expect(proximaVerificacao(true, AO_VIVO.ociosoAposMs - 1)).toBe(5_000);
  });

  it("tela parada há 3 minutos passa para 30 segundos", () => {
    expect(proximaVerificacao(true, 3 * MIN)).toBe(30_000);
    expect(proximaVerificacao(true, 8 * 60 * MIN)).toBe(30_000);
  });

  it("monitor ligado o dia inteiro, parado, cabe folgado no plano grátis", () => {
    // Cada pergunta passa por dois projetos na Vercel (front e api). O Hobby
    // dá 1 milhão de requisições por mês; um monitor sozinho fica bem abaixo.
    const porDia = (24 * 60 * MIN) / proximaVerificacao(true, 24 * 60 * MIN)!;
    expect(porDia * 2 * 31).toBeLessThan(200_000);
  });
});

describe("voltouDaOciosidade", () => {
  it("só depois de 3 minutos parada", () => {
    expect(voltouDaOciosidade(10_000)).toBe(false);
    expect(voltouDaOciosidade(3 * MIN)).toBe(true);
  });
});
