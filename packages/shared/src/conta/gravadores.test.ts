import { describe, expect, it } from "vitest";

import { estadoGravadorSchema, gravadorOnline, nomePadraoGravador, sinalEmPalavras } from "./gravadores";

describe("gravadorOnline", () => {
  const agora = new Date("2026-11-11T13:00:00Z");

  it("online até 3 min depois do último aviso; depois, offline", () => {
    expect(gravadorOnline("2026-11-11T12:57:00Z", agora)).toBe(true);
    expect(gravadorOnline(new Date("2026-11-11T12:56:59Z"), agora)).toBe(false);
  });
});

describe("sinalEmPalavras", () => {
  it("bom até -67 dBm, fraco até -80, muito fraco abaixo", () => {
    expect(sinalEmPalavras(-50)).toBe("bom");
    expect(sinalEmPalavras(-67)).toBe("bom");
    expect(sinalEmPalavras(-68)).toBe("fraco");
    expect(sinalEmPalavras(-80)).toBe("fraco");
    expect(sinalEmPalavras(-81)).toBe("muito fraco");
  });
});

describe("nomePadraoGravador", () => {
  it("usa o fim da série (MAC), sem dois-pontos e em maiúsculas", () => {
    expect(nomePadraoGravador("a4:cf:12:9b:1a:2b")).toBe("Gravador 1A2B");
  });
});

describe("estadoGravadorSchema", () => {
  const estado = {
    serie: "a4:cf:12:9b:1a:2b",
    versao: "Nov 11 2026 10:20:00",
    wifi: { rede: "Sollucao_visitantes", sinalDbm: -78, ip: "192.168.100.161" },
    fila: 2,
    recusadas: 0,
    cartao: { ok: true, livreGb: 7.9 },
    ultimoErro: { texto: "ERRO: envio falhou", haSeg: 120 },
    boot: { motivo: "ligada na energia", haSeg: 3600 },
    empresaAtual: "org-1",
  };

  it("aceita o que a placa manda", () => {
    expect(estadoGravadorSchema.safeParse(estado).success).toBe(true);
    expect(estadoGravadorSchema.safeParse({ ...estado, ultimoErro: null, empresaAtual: null }).success).toBe(true);
  });

  it("recusa sem série e com fila negativa", () => {
    expect(estadoGravadorSchema.safeParse({ ...estado, serie: "" }).success).toBe(false);
    expect(estadoGravadorSchema.safeParse({ ...estado, fila: -1 }).success).toBe(false);
  });
});
