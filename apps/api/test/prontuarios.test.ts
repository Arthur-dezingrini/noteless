import { beforeAll, describe, expect, it } from "vitest";

import { chamar, criarFazenda } from "./ajuda";

let f: Awaited<ReturnType<typeof criarFazenda>>;
let thorId: string;
const org = () => `/api/org/${f.orgId}`;

beforeAll(async () => {
  f = await criarFazenda("Santa Rita");
  thorId = (await chamar(f.dono, "POST", `${org()}/animais`, { nome: "Thor", especie: "cao" })).json.id;
});

async function consultaDoThor(data = "2026-09-21") {
  const r = await chamar(f.membro, "POST", `${org()}/consultas`, { animalId: thorId, data, hora: "10:00", duracaoMin: 30, tipo: "consulta" });
  return r.json.id as string;
}

async function consultas() {
  return (await chamar(f.membro, "GET", `${org()}/consultas`)).json as { id: string; data: string; hora: string; tipo: string; status: string; prontuarioId?: string | null }[];
}

describe("prontuários", () => {
  it("registrar o atendimento conclui a consulta e marca o retorno na agenda", async () => {
    const consultaId = await consultaDoThor();
    const r = await chamar(f.membro, "POST", `${org()}/prontuarios`, {
      animalId: thorId,
      consultaId,
      veterinarioId: f.membro.id,
      data: "2026-09-21",
      tipo: "consulta",
      queixa: "Coçando a orelha esquerda.",
      exame: [{ nome: "Temperatura", valor: "38,8 °C" }],
      diagnostico: "Otite externa.",
      remedios: [{ nome: "Otomax", como: "5 gotas, 2x ao dia" }],
      retorno: { data: "2026-10-02", hora: "09:30" },
    });
    expect(r.status).toBe(201);

    const agenda = await consultas();
    expect(agenda.find((c) => c.id === consultaId)).toMatchObject({ status: "concluida", prontuarioId: r.json.id });
    expect(agenda.find((c) => c.data === "2026-10-02")).toMatchObject({ hora: "09:30", tipo: "retorno", status: "agendada" });

    const [p] = (await chamar(f.membro, "GET", `${org()}/prontuarios`)).json;
    expect(p).toMatchObject({
      id: r.json.id,
      animalNome: "Thor",
      veterinarioNome: "Membro",
      diagnostico: "Otite externa.",
      remedios: [{ nome: "Otomax", como: "5 gotas, 2x ao dia" }],
      retorno: { data: "2026-10-02", hora: "09:30" },
    });
  });

  it("uma consulta só tem um atendimento", async () => {
    const consultaId = await consultaDoThor("2026-09-22");
    const corpo = { animalId: thorId, consultaId, data: "2026-09-22", tipo: "consulta", queixa: "Vômito." };
    expect((await chamar(f.membro, "POST", `${org()}/prontuarios`, corpo)).status).toBe(201);

    const segundo = await chamar(f.membro, "POST", `${org()}/prontuarios`, corpo);
    expect(segundo.status).toBe(400);
    expect(segundo.json.error).toBe("Essa consulta já tem atendimento registrado.");
  });

  it("atendimento vazio é recusado", async () => {
    const r = await chamar(f.membro, "POST", `${org()}/prontuarios`, { animalId: thorId, data: "2026-09-23", tipo: "consulta" });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Escreva pelo menos a queixa ou o diagnóstico.");
  });

  it("tirar o retorno ao corrigir tira a consulta da agenda", async () => {
    const criado = await chamar(f.membro, "POST", `${org()}/prontuarios`, {
      animalId: thorId,
      data: "2026-09-24",
      tipo: "checkup",
      diagnostico: "Saudável.",
      retorno: { data: "2026-11-05", hora: "08:00" },
    });
    expect((await consultas()).some((c) => c.data === "2026-11-05")).toBe(true);

    const corrigido = await chamar(f.membro, "PATCH", `${org()}/prontuarios/${criado.json.id}`, {
      animalId: thorId,
      data: "2026-09-24",
      tipo: "checkup",
      diagnostico: "Saudável.",
      retorno: null,
    });
    expect(corrigido.status).toBe(200);
    expect((await consultas()).some((c) => c.data === "2026-11-05")).toBe(false);
  });

  it("só o administrador apaga", async () => {
    const { json } = await chamar(f.membro, "POST", `${org()}/prontuarios`, { animalId: thorId, data: "2026-09-25", tipo: "consulta", queixa: "Mancando." });

    const membro = await chamar(f.membro, "DELETE", `${org()}/prontuarios/${json.id}`);
    expect(membro.status).toBe(403);
    expect(membro.json.error).toBe("Só o administrador apaga um atendimento.");

    expect((await chamar(f.admin, "DELETE", `${org()}/prontuarios/${json.id}`)).status).toBe(200);
  });
});
