import { describe, expect, it } from "vitest";

import { adicionarDias, dataExtenso, diaCurto, duracaoCurta, haQuantoTempo, idade, inicioDaSemana, mesAno } from "./datas";

describe("adicionarDias", () => {
  it("vira o mês e o ano", () => {
    expect(adicionarDias("2026-09-30", 1)).toBe("2026-10-01");
    expect(adicionarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(adicionarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("respeita ano bissexto", () => {
    expect(adicionarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("não escorrega de dia na troca de horário de verão", () => {
    // Datas são "de parede": somar 1 dia é sempre o dia seguinte.
    expect(adicionarDias("2026-11-01", 1)).toBe("2026-11-02");
    expect(adicionarDias("2027-02-20", 1)).toBe("2027-02-21");
  });
});

describe("inicioDaSemana", () => {
  it("volta para o domingo", () => {
    expect(inicioDaSemana("2026-09-24")).toBe("2026-09-20"); // quinta → domingo
    expect(inicioDaSemana("2026-09-20")).toBe("2026-09-20"); // domingo fica
  });

  it("atravessa o mês", () => {
    expect(inicioDaSemana("2026-10-01")).toBe("2026-09-27");
  });
});

describe("idade", () => {
  const hoje = "2026-09-24";

  it("em anos", () => {
    expect(idade("2022-09-24", hoje)).toBe("4 anos");
    expect(idade("2025-09-01", hoje)).toBe("1 ano");
  });

  it("só faz aniversário no dia", () => {
    expect(idade("2022-09-25", hoje)).toBe("3 anos");
  });

  it("em meses quando tem menos de 1 ano", () => {
    expect(idade("2026-01-10", hoje)).toBe("8 meses");
    expect(idade("2026-08-24", hoje)).toBe("1 mês");
    expect(idade("2026-09-10", hoje)).toBe("menos de 1 mês");
  });

  it("sem nascimento ou nascimento no futuro não mostra nada", () => {
    expect(idade(null, hoje)).toBeNull();
    expect(idade(undefined, hoje)).toBeNull();
    expect(idade("2027-01-01", hoje)).toBeNull();
  });
});

describe("haQuantoTempo", () => {
  const agora = new Date("2026-09-24T15:00:00-03:00");
  const antes = (min: number) => new Date(agora.getTime() - min * 60_000);

  it("minutos e horas", () => {
    expect(haQuantoTempo(antes(0), agora)).toBe("agora");
    expect(haQuantoTempo(antes(12), agora)).toBe("há 12 min");
    expect(haQuantoTempo(antes(120), agora)).toBe("há 2 h");
  });

  it("ontem e dias", () => {
    expect(haQuantoTempo(antes(24 * 60), agora)).toBe("ontem");
    expect(haQuantoTempo(antes(3 * 24 * 60), agora)).toBe("há 3 dias");
  });

  it("mais de uma semana vira a data", () => {
    expect(haQuantoTempo(antes(10 * 24 * 60), agora)).toBe("14 de set.");
  });
});

describe("duracaoCurta", () => {
  it("minutos e segundos", () => {
    expect(duracaoCurta(74)).toBe("1:14");
    expect(duracaoCurta(5)).toBe("0:05");
    expect(duracaoCurta(28.4)).toBe("0:28");
  });

  it("negativo vira zero", () => {
    expect(duracaoCurta(-3)).toBe("0:00");
  });
});

describe("textos de data", () => {
  it("dataExtenso", () => {
    expect(dataExtenso("2026-09-01")).toBe("Terça-feira, 1 de setembro de 2026");
  });

  it("mesAno", () => {
    expect(mesAno(2026, 9)).toBe("Setembro 2026");
  });

  it("diaCurto tira o “-feira”", () => {
    expect(diaCurto("2026-09-24")).toBe("Quinta, 24 de setembro");
  });
});
