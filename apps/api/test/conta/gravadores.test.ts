import { beforeAll, describe, expect, it } from "vitest";

import { chamar, criarFazenda, criarSuper, type Pessoa } from "../ajuda";

type Fazenda = Awaited<ReturnType<typeof criarFazenda>>;

let a: Fazenda;
let b: Fazenda;
let sup: Pessoa;
/** A conta com que a placa entra: membro comum da Granja A. */
let placa: Pessoa;

beforeAll(async () => {
  a = await criarFazenda("Granja A");
  b = await criarFazenda("Granja B");
  sup = await criarSuper();
  placa = a.membro;
});

const estado = (serie: string, extra: Record<string, unknown> = {}) => ({
  serie,
  versao: "Nov 11 2026 10:20:00",
  wifi: { rede: "Sollucao_visitantes", sinalDbm: -78, ip: "192.168.100.161" },
  fila: 2,
  recusadas: 0,
  cartao: { ok: true, livreGb: 7.9 },
  ultimoErro: { texto: "ERRO: envio falhou", haSeg: 120 },
  boot: { motivo: "ligada na energia", haSeg: 3600 },
  empresaAtual: a.orgId,
  ...extra,
});

const avisar = (quem: Pessoa | null, corpo: unknown) => chamar(quem, "POST", "/api/gravadores/estado", corpo);
const todos = async () => (await chamar(sup, "GET", "/api/admin/gravadores")).json as { id: string; serie: string; [k: string]: any }[];
const achar = async (serie: string) => (await todos()).find((g) => g.serie === serie)!;
const series = async (quem: Pessoa, orgId: string) => ((await chamar(quem, "GET", `/api/org/${orgId}/gravadores`)).json as { serie: string }[]).map((g) => g.serie);

describe("POST /api/gravadores/estado", () => {
  it("sem login 401; corpo inválido 400", async () => {
    expect((await avisar(null, estado("aa:00"))).status).toBe(401);
    expect((await avisar(placa, { ...estado("aa:00"), fila: -1 })).status).toBe(400);
  });

  it("primeiro aviso cria a placa com a empresa que ela já usa e responde o destino", async () => {
    const antes = Date.now();
    const r = await avisar(placa, estado("a4:cf:12:9b:1a:2b"));
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ destino: { id: a.orgId, nome: "Granja A" }, aviso: null });

    const g = await achar("a4:cf:12:9b:1a:2b");
    expect(g).toMatchObject({ nome: "Gravador 1A2B", conta: { email: placa.email }, destino: { id: a.orgId }, destinoValido: true });
    expect(g.estado).toMatchObject({ fila: 2, wifi: { rede: "Sollucao_visitantes" }, boot: { motivo: "ligada na energia" } });
    // "há 120 s" vira hora do servidor
    const erroEm = new Date(g.estado.ultimoErro.em).getTime();
    expect(erroEm).toBeLessThanOrEqual(antes - 119_000);
    expect(erroEm).toBeGreaterThan(antes - 130_000);
  });

  it("aviso seguinte atualiza o estado sem criar outra", async () => {
    await avisar(placa, estado("a4:cf:12:9b:1a:2b", { fila: 0, ultimoErro: null }));
    const iguais = (await todos()).filter((g) => g.serie === "a4:cf:12:9b:1a:2b");
    expect(iguais).toHaveLength(1);
    expect(iguais[0]!.estado).toMatchObject({ fila: 0, ultimoErro: null });
  });

  it("guarda o histórico de erros, do mais novo para o mais antigo, sem duplicar o reenvio", async () => {
    const erros = [
      { texto: "AVISO: Wi-Fi caiu (status 5).", haSeg: 600 },
      { texto: "ERRO: login falhou (HTTP 401)", haSeg: 300 },
    ];
    await avisar(placa, estado("cc:cc:cc:cc:00:01", { erros }));
    // resposta perdida: a placa manda os mesmos de novo, junto com um novo
    await avisar(placa, estado("cc:cc:cc:cc:00:01", { erros: [...erros, { texto: "ERRO: o cartão não respondeu.", haSeg: 10 }] }));

    const g = await achar("cc:cc:cc:cc:00:01");
    expect(g.estado.erros.map((x: { texto: string }) => x.texto)).toEqual([
      "ERRO: o cartão não respondeu.",
      "ERRO: login falhou (HTTP 401)",
      "AVISO: Wi-Fi caiu (status 5).",
    ]);
    expect(new Date(g.estado.erros[0].em).getTime()).toBeGreaterThan(new Date(g.estado.erros[1].em).getTime());
  });

  it("outra conta não toma a placa (409)", async () => {
    const r = await avisar(b.membro, estado("a4:cf:12:9b:1a:2b", { empresaAtual: b.orgId }));
    expect(r.status).toBe(409);
    expect((await achar("a4:cf:12:9b:1a:2b")).conta.email).toBe(placa.email);
  });

  it("empresa atual sem vínculo: a placa nasce sem destino e a resposta diz o motivo", async () => {
    const r = await avisar(placa, estado("bb:bb:bb:bb:00:01", { empresaAtual: b.orgId }));
    expect(r.json).toEqual({ destino: null, aviso: "Nenhuma empresa escolhida para este gravador." });
    expect((await achar("bb:bb:bb:bb:00:01")).destino).toBeNull();
  });
});

describe("quem vê os gravadores de uma empresa", () => {
  it("administrador e dono da empresa de destino veem; de outra empresa não", async () => {
    expect(await series(a.admin, a.orgId)).toContain("a4:cf:12:9b:1a:2b");
    expect(await series(a.dono, a.orgId)).toContain("a4:cf:12:9b:1a:2b");
    expect(await series(b.admin, b.orgId)).not.toContain("a4:cf:12:9b:1a:2b");
    expect((await chamar(b.admin, "GET", `/api/org/${a.orgId}/gravadores`)).status).toBe(403);
  });

  it("membro comum não vê (403)", async () => {
    const r = await chamar(a.membro, "GET", `/api/org/${a.orgId}/gravadores`);
    expect(r.status).toBe(403);
  });
});

describe("/api/admin/gravadores", () => {
  it("sem login 401; quem não é super 403", async () => {
    const g = await achar("a4:cf:12:9b:1a:2b");
    expect((await chamar(null, "GET", "/api/admin/gravadores")).status).toBe(401);
    for (const [metodo, caminho, corpo] of [
      ["GET", "/api/admin/gravadores", undefined],
      ["PATCH", `/api/admin/gravadores/${g.id}`, { nome: "Meu" }],
      ["DELETE", `/api/admin/gravadores/${g.id}`, undefined],
    ] as const) {
      const r = await chamar(a.dono, metodo, caminho, corpo);
      expect(r.status, `${metodo} ${caminho}`).toBe(403);
      expect(r.json.error).toBe("Só o super usuário mexe nos gravadores.");
    }
  });

  it("renomeia", async () => {
    const g = await achar("a4:cf:12:9b:1a:2b");
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { nome: "Galpão 1" })).status).toBe(200);
    expect((await achar("a4:cf:12:9b:1a:2b")).nome).toBe("Galpão 1");
  });

  it("não aceita empresa à qual a conta da placa não está vinculada", async () => {
    const g = await achar("a4:cf:12:9b:1a:2b");
    const r = await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { organizationId: b.orgId });
    expect(r.status).toBe(409);
    expect(r.json.error).toContain("não está vinculada a Granja B");
  });

  it("troca a empresa: o próximo aviso já responde a nova, e quem vê muda junto", async () => {
    const g = await achar("a4:cf:12:9b:1a:2b");
    const v = await chamar(sup, "POST", "/api/admin/vinculos", { userId: placa.id, organizationId: b.orgId, papel: "member" });
    expect(v.status).toBe(201);
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { organizationId: b.orgId })).status).toBe(200);

    expect((await avisar(placa, estado("a4:cf:12:9b:1a:2b"))).json).toEqual({ destino: { id: b.orgId, nome: "Granja B" }, aviso: null });
    expect(await series(b.admin, b.orgId)).toContain("a4:cf:12:9b:1a:2b");
    expect(await series(a.admin, a.orgId)).not.toContain("a4:cf:12:9b:1a:2b");

    // A conta sai da Granja B: a placa fica sem destino, e a tela mostra por quê.
    await chamar(sup, "DELETE", `/api/admin/vinculos/${v.json.memberId}`);
    expect((await avisar(placa, estado("a4:cf:12:9b:1a:2b"))).json).toEqual({
      destino: null,
      aviso: "A conta do gravador não está vinculada a Granja B.",
    });
    expect(await achar("a4:cf:12:9b:1a:2b")).toMatchObject({ destino: { id: b.orgId }, destinoValido: false });
  });

  it("esquece a placa; depois outra conta pode assumir", async () => {
    const g = await achar("a4:cf:12:9b:1a:2b");
    expect((await chamar(sup, "DELETE", `/api/admin/gravadores/${g.id}`)).status).toBe(200);
    expect((await chamar(sup, "DELETE", `/api/admin/gravadores/${g.id}`)).status).toBe(404);
    expect((await avisar(b.membro, estado("a4:cf:12:9b:1a:2b", { empresaAtual: b.orgId }))).status).toBe(200);
    expect((await achar("a4:cf:12:9b:1a:2b")).conta.email).toBe(b.membro.email);
  });
});
