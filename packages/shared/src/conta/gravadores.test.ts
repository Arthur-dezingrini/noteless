import { describe, expect, it } from "vitest";

import { estadoGravadorSchema, gravadorOnline, juntarErros, nomePadraoGravador, sinalEmPalavras } from "./gravadores";

describe("gravadorOnline", () => {
  const agora = new Date("2026-11-11T13:00:00Z");

  it("ativo até 20 min depois do último aviso (a placa avisa a cada 15); depois, sem contato", () => {
    expect(gravadorOnline("2026-11-11T12:40:00Z", agora)).toBe(true);
    expect(gravadorOnline(new Date("2026-11-11T12:39:59Z"), agora)).toBe(false);
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

describe("juntarErros", () => {
  const e = (texto: string, em: string) => ({ texto, em });

  it("os novos (que chegam do mais antigo para o mais novo) vão para o topo", () => {
    const antigos = [e("ERRO: b", "2026-11-11T10:00:00.000Z"), e("ERRO: a", "2026-11-11T09:00:00.000Z")];
    const novos = [e("AVISO: c", "2026-11-11T11:00:00.000Z"), e("ERRO: d", "2026-11-11T12:00:00.000Z")];
    expect(juntarErros(antigos, novos).map((x) => x.texto)).toEqual(["ERRO: d", "AVISO: c", "ERRO: b", "ERRO: a"]);
  });

  it("o mesmo erro mandado de novo (resposta perdida) não duplica", () => {
    const antigos = [e("ERRO: a", "2026-11-11T10:00:00.000Z")];
    // a placa reenvia: o "há N s" dá uma hora alguns segundos diferente
    expect(juntarErros(antigos, [e("ERRO: a", "2026-11-11T10:00:03.000Z")])).toHaveLength(1);
    expect(juntarErros(antigos, [e("ERRO: a", "2026-11-11T10:05:00.000Z")])).toHaveLength(2);
  });

  it("guarda no máximo os 50 mais novos", () => {
    const muitos = Array.from({ length: 60 }, (_, i) => e(`ERRO: ${i}`, new Date(Date.UTC(2026, 10, 11, 0, i)).toISOString()));
    const r = juntarErros([], muitos);
    expect(r).toHaveLength(50);
    expect(r[0]!.texto).toBe("ERRO: 59");
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

  it("sem a lista de erros (firmware antigo), entende como vazia", () => {
    const r = estadoGravadorSchema.safeParse(estado);
    expect(r.success && r.data.erros).toEqual([]);
  });

  it("recusa sem série e com fila negativa", () => {
    expect(estadoGravadorSchema.safeParse({ ...estado, serie: "" }).success).toBe(false);
    expect(estadoGravadorSchema.safeParse({ ...estado, fila: -1 }).success).toBe(false);
  });
});
