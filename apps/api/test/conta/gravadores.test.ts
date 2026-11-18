import { eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { app } from "../../src/app";
import { codigoDePareamento } from "../../src/base/gravador-atual";
import { db } from "../../src/db";
import { account, user } from "../../src/db/schema";
import { gravador } from "../../src/db/tabelas/conta";
import { ocorrencia } from "../../src/db/tabelas/notas";
import { chamar, criarFazenda, criarSuper, type Pessoa } from "../ajuda";

// A IA fica de fora: o que está em teste é quem pode mandar a nota.
vi.mock("../../src/modulos/notas/ia/transcrever", async (original) => ({
  ...(await original<typeof import("../../src/modulos/notas/ia/transcrever")>()),
  transcrever: vi.fn(async () => "Vaca 23 com febre."),
}));
vi.mock("../../src/modulos/notas/ia/analisar", async (original) => ({
  ...(await original<typeof import("../../src/modulos/notas/ia/analisar")>()),
  analisar: vi.fn(async () => ({ resumo: "Febre na 23.", operacoes: [] })),
}));

type Fazenda = Awaited<ReturnType<typeof criarFazenda>>;

let a: Fazenda;
let b: Fazenda;
let sup: Pessoa;

beforeAll(async () => {
  a = await criarFazenda("Granja A");
  b = await criarFazenda("Granja B");
  sup = await criarSuper();
});

/** A placa: série (o MAC) e o segredo que ela sorteou na primeira vez que ligou. */
type Placa = { serie: string; segredo: string };
const placa = (serie: string, byte: string): Placa => ({ serie, segredo: byte.repeat(32) });
const P1 = placa("A4:CF:12:9B:1A:2B", "a1");

const estado = (serie: string, extra: Record<string, unknown> = {}) => ({
  serie,
  versao: "Nov 15 2026 10:20:00",
  wifi: { rede: "Arthur ", sinalDbm: -60, ip: "192.168.0.143" },
  fila: 2,
  recusadas: 0,
  cartao: { ok: true, livreGb: 0.0026 },
  ultimoErro: { texto: "ERRO: envio falhou", haSeg: 120 },
  boot: { motivo: "ligada na energia", haSeg: 3600 },
  ...extra,
});

const credencial = (p: Placa) => `Gravador ${p.serie} ${p.segredo}`;

async function pedir(caminho: string, init: RequestInit) {
  const res = await app.request(caminho, init);
  const texto = await res.text();
  return { status: res.status, json: (texto ? JSON.parse(texto) : null) as any };
}

/** Aviso de estado como a placa manda: sem cookie, com a credencial dela. */
const avisar = (p: Placa | null, corpo: unknown = estado(p?.serie ?? "x"), authorization = p ? credencial(p) : undefined) =>
  pedir("/api/gravadores/estado", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(corpo),
  });

/** Áudio como a placa manda: multipart, com a credencial dela. */
function enviarNota(p: Placa, orgId: string, authorization = credencial(p)) {
  const form = new FormData();
  form.set("audio", new File([new Uint8Array(800)], "t1794608625306.wav", { type: "audio/wav" }));
  form.set("duracaoSeg", "4");
  return pedir(`/api/org/${orgId}/ocorrencias`, { method: "POST", headers: { Authorization: authorization }, body: form });
}

const todos = async () => (await chamar(sup, "GET", "/api/admin/gravadores")).json as { id: string; serie: string; [k: string]: any }[];
const achar = async (serie: string) => (await todos()).find((g) => g.serie === serie)!;
const series = async (quem: Pessoa, orgId: string) => ((await chamar(quem, "GET", `/api/org/${orgId}/gravadores`)).json as { serie: string }[]).map((g) => g.serie);
const aprovar = async (serie: string, corpo: Record<string, unknown>, quem: Pessoa = sup) =>
  chamar(quem, "POST", `/api/admin/gravadores/${(await achar(serie)).id}/aprovar`, corpo);

describe("codigoDePareamento", () => {
  it("6 letras e números sem 0, O, 1 e I; o firmware tem de chegar nos mesmos", () => {
    // Os mesmos dois exemplos estão no firmware (configuracao.ino), para conferir a conta de lá.
    expect(codigoDePareamento("00".repeat(32))).toBe("P28-84K");
    expect(codigoDePareamento("0123456789abcdef".repeat(4))).toBe("U73-HL2");
    expect(codigoDePareamento(P1.segredo)).toMatch(/^[2-9A-HJ-NP-Z]{3}-[2-9A-HJ-NP-Z]{3}$/);
  });
});

describe("POST /api/gravadores/estado — a placa se apresenta", () => {
  it("sem credencial ou malformada 401; corpo inválido 400; série do corpo diferente da credencial 400", async () => {
    expect((await avisar(null, estado(P1.serie))).status).toBe(401);
    expect((await avisar(P1, estado(P1.serie), `Gravador ${P1.serie} curto`)).status).toBe(401);
    expect((await avisar(P1, estado(P1.serie), `Bearer ${P1.segredo}`)).status).toBe(401);
    expect((await avisar(P1, { ...estado(P1.serie), fila: -1 })).status).toBe(400);
    expect((await avisar(P1, estado("A4:CF:12:9B:1A:2C"))).status).toBe(400);
  });

  it("placa nova entra aguardando aprovação (202), com o código que sai do segredo", async () => {
    const r = await avisar(P1);
    expect(r.status).toBe(202);
    expect(r.json).toEqual({ destino: null, aviso: `Aguardando aprovação no Noteless (código ${codigoDePareamento(P1.segredo)}).`, pausado: false, firmware: null });

    const g = await achar(P1.serie);
    expect(g).toMatchObject({ nome: "Gravador 1A2B", aprovado: false, destino: null });
    expect(g).not.toHaveProperty("codigo"); // quem aprova tem de ler na placa
    expect(g.estado).toMatchObject({ fila: 2, wifi: { rede: "Arthur " } });
    expect(await series(a.admin, a.orgId)).not.toContain(P1.serie);
  });

  it("aviso seguinte atualiza o estado sem criar outra, e segue aguardando", async () => {
    const r = await avisar(P1, estado(P1.serie, { fila: 0, ultimoErro: null }));
    expect(r.status).toBe(202);
    const iguais = (await todos()).filter((g) => g.serie === P1.serie);
    expect(iguais).toHaveLength(1);
    expect(iguais[0]!.estado).toMatchObject({ fila: 0, ultimoErro: null });
  });

  it("a mesma série com outro segredo é recusada (403) e não mexe na placa", async () => {
    const impostora = placa(P1.serie, "ee");
    const r = await avisar(impostora, estado(P1.serie, { fila: 9 }));
    expect(r.status).toBe(403);
    expect(r.json.error).toContain("outro segredo");
    expect((await achar(P1.serie)).estado.fila).toBe(0);
  });

  it("aguardando aprovação, não manda nota (403)", async () => {
    expect((await enviarNota(P1, a.orgId)).status).toBe(403);
  });

  it("guarda o histórico de erros, do mais novo para o mais antigo, sem duplicar o reenvio", async () => {
    const p = placa("CC:CC:CC:CC:00:01", "c1");
    const erros = [
      { texto: "AVISO: Wi-Fi caiu (status 5).", haSeg: 600 },
      { texto: "ERRO: Wi-Fi não conectou", haSeg: 300 },
    ];
    await avisar(p, estado(p.serie, { erros }));
    // resposta perdida: a placa manda os mesmos de novo, junto com um novo
    await avisar(p, estado(p.serie, { erros: [...erros, { texto: "ERRO: a memória interna falhou.", haSeg: 10 }] }));

    const g = await achar(p.serie);
    expect(g.estado.erros.map((x: { texto: string }) => x.texto)).toEqual([
      "ERRO: a memória interna falhou.",
      "ERRO: Wi-Fi não conectou",
      "AVISO: Wi-Fi caiu (status 5).",
    ]);
    expect(new Date(g.estado.erros[0].em).getTime()).toBeGreaterThan(new Date(g.estado.erros[1].em).getTime());
  });
});

describe("aprovação", () => {
  it("sem login 401; quem não é super 403", async () => {
    const id = (await achar(P1.serie)).id;
    expect((await chamar(null, "POST", `/api/admin/gravadores/${id}/aprovar`, { codigo: "x", organizationId: a.orgId })).status).toBe(401);
    const r = await aprovar(P1.serie, { codigo: codigoDePareamento(P1.segredo), organizationId: a.orgId }, a.dono);
    expect(r.status).toBe(403);
    expect((await achar(P1.serie)).aprovado).toBe(false);
  });

  it("código errado 400; empresa que não existe 404; sem código 400", async () => {
    const r = await aprovar(P1.serie, { codigo: "AAA-AAA", organizationId: a.orgId });
    expect(r.status).toBe(400);
    expect(r.json.error).toContain("Código errado");
    expect((await aprovar(P1.serie, { codigo: codigoDePareamento(P1.segredo), organizationId: "nao-existe" })).status).toBe(404);
    expect((await aprovar(P1.serie, { codigo: "", organizationId: a.orgId })).status).toBe(400);
    expect((await achar(P1.serie)).aprovado).toBe(false);
  });

  it("aprova com o código digitado de qualquer jeito; o próximo aviso responde a empresa (200)", async () => {
    const digitado = codigoDePareamento(P1.segredo).toLowerCase().replace("-", " ");
    expect((await aprovar(P1.serie, { codigo: digitado, organizationId: a.orgId, nome: "Galpão 1" })).status).toBe(200);
    expect(await achar(P1.serie)).toMatchObject({ aprovado: true, nome: "Galpão 1", destino: { id: a.orgId, nome: "Granja A" } });

    const r = await avisar(P1);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ destino: { id: a.orgId, nome: "Granja A" }, aviso: null, pausado: false, firmware: null });
    expect((await aprovar(P1.serie, { codigo: codigoDePareamento(P1.segredo), organizationId: a.orgId })).status).toBe(409);
  });

  it("aprovada, manda nota para a empresa dela, assinada com o nome do gravador", async () => {
    const r = await enviarNota(P1, a.orgId);
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ criadoPorNome: "Galpão 1", transcricao: "Vaca 23 com febre." });
  });

  it("não manda para outra empresa nem com o segredo errado (403)", async () => {
    expect((await enviarNota(P1, b.orgId)).status).toBe(403);
    expect((await enviarNota(placa(P1.serie, "ee"), a.orgId)).status).toBe(403);
  });

  it("só manda nota: não lê as notas da empresa (403)", async () => {
    const r = await pedir(`/api/org/${a.orgId}/ocorrencias`, { headers: { Authorization: credencial(P1) } });
    expect(r.status).toBe(403);
  });

  it("a conta técnica fica fora da lista de usuários e ninguém entra com ela", async () => {
    const usuarios = (await chamar(sup, "GET", "/api/admin/usuarios")).json as { email: string }[];
    expect(usuarios.some((u) => u.email.endsWith("@gravador.invalid"))).toBe(false);
    const login = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "a4cf129b1a2b@gravador.invalid", password: P1.segredo }),
    });
    expect(login.status).toBe(401);
  });
});

describe("quem vê os gravadores de uma empresa", () => {
  it("administrador e dono da empresa de destino veem; de outra empresa não", async () => {
    expect(await series(a.admin, a.orgId)).toContain(P1.serie);
    expect(await series(a.dono, a.orgId)).toContain(P1.serie);
    expect(await series(b.admin, b.orgId)).not.toContain(P1.serie);
    expect((await chamar(b.admin, "GET", `/api/org/${a.orgId}/gravadores`)).status).toBe(403);
  });

  it("membro comum não vê (403)", async () => {
    expect((await chamar(a.membro, "GET", `/api/org/${a.orgId}/gravadores`)).status).toBe(403);
  });
});

describe("/api/admin/gravadores", () => {
  it("sem login 401; quem não é super 403", async () => {
    const g = await achar(P1.serie);
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

  it("renomeia: as notas novas saem com o nome novo", async () => {
    const g = await achar(P1.serie);
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { nome: "Galpão 2" })).status).toBe(200);
    expect((await achar(P1.serie)).nome).toBe("Galpão 2");
    expect((await enviarNota(P1, a.orgId)).json.criadoPorNome).toBe("Galpão 2");
  });

  it("troca para qualquer empresa: o próximo aviso responde a nova, as notas e quem vê mudam junto", async () => {
    const g = await achar(P1.serie);
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { organizationId: "nao-existe" })).status).toBe(404);
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { organizationId: b.orgId })).status).toBe(200);

    expect((await avisar(P1)).json).toEqual({ destino: { id: b.orgId, nome: "Granja B" }, aviso: null, pausado: false, firmware: null });
    expect((await enviarNota(P1, b.orgId)).status).toBe(201);
    expect((await enviarNota(P1, a.orgId)).status).toBe(403);
    expect(await series(b.admin, b.orgId)).toContain(P1.serie);
    expect(await series(a.admin, a.orgId)).not.toContain(P1.serie);
  });

  it("pausa o envio: o próximo aviso responde pausado e a lista mostra; retomar volta ao normal", async () => {
    const g = await achar(P1.serie);
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { envioPausado: true })).status).toBe(200);
    expect((await avisar(P1)).json).toEqual({ destino: { id: b.orgId, nome: "Granja B" }, aviso: null, pausado: true, firmware: null });
    expect(await achar(P1.serie)).toMatchObject({ envioPausado: true, destino: { id: b.orgId } });
    const daEmpresa = (await chamar(b.admin, "GET", `/api/org/${b.orgId}/gravadores`)).json as { serie: string; envioPausado: boolean }[];
    expect(daEmpresa.find((x) => x.serie === P1.serie)?.envioPausado).toBe(true);

    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${g.id}`, { envioPausado: false })).status).toBe(200);
    expect((await avisar(P1)).json.pausado).toBe(false);
  });

  it("dono e administrador da empresa de destino não pausam (403)", async () => {
    const g = await achar(P1.serie);
    for (const quem of [b.dono, b.admin]) expect((await chamar(quem, "PATCH", `/api/admin/gravadores/${g.id}`, { envioPausado: true })).status).toBe(403);
    expect((await achar(P1.serie)).envioPausado).toBe(false);
  });

  it("esquecer corta o acesso na hora; ligada, a placa volta aguardando e, aprovada de novo, assina com a mesma conta", async () => {
    const g = await achar(P1.serie);
    const [antes] = await db.select({ userId: gravador.userId }).from(gravador).where(eq(gravador.id, g.id));

    expect((await chamar(sup, "DELETE", `/api/admin/gravadores/${g.id}`)).status).toBe(200);
    expect((await chamar(sup, "DELETE", `/api/admin/gravadores/${g.id}`)).status).toBe(404);
    expect((await enviarNota(P1, b.orgId)).status).toBe(403);

    expect((await avisar(P1)).status).toBe(202);
    expect((await aprovar(P1.serie, { codigo: codigoDePareamento(P1.segredo), organizationId: a.orgId })).status).toBe(200);
    const [depois] = await db.select({ userId: gravador.userId }).from(gravador).where(eq(gravador.serie, P1.serie));
    expect(depois!.userId).toBe(antes!.userId);
    // as notas de antes de esquecer continuam assinadas
    const assinadas = await db.select({ id: ocorrencia.id }).from(ocorrencia).where(eq(ocorrencia.criadoPorId, antes!.userId!));
    expect(assinadas.length).toBeGreaterThanOrEqual(3);
  });
});

describe("placas aguardando aprovação têm teto e prazo", () => {
  it("passando de 20, a placa nova é recusada (429); as paradas há mais de 7 dias saem sozinhas", async () => {
    const aguardando = async () => (await db.select({ id: gravador.id }).from(gravador).where(isNull(gravador.aprovadoEm))).length;
    for (let i = (await aguardando()) + 1; i <= 20; i++) {
      const p = placa(`DD:DD:DD:DD:00:${i.toString(16).padStart(2, "0")}`, i.toString(16).padStart(2, "0"));
      expect((await avisar(p)).status).toBe(202);
    }
    expect(await aguardando()).toBe(20);
    const sobrando = placa("DD:DD:DD:DD:01:00", "fe");
    const r = await avisar(sobrando);
    expect(r.status).toBe(429);

    const oitoDias = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.update(gravador).set({ vistoEm: oitoDias }).where(eq(gravador.serie, "DD:DD:DD:DD:00:14"));
    expect((await avisar(sobrando)).status).toBe(202);
    expect((await todos()).some((g) => g.serie === "DD:DD:DD:DD:00:14")).toBe(false);
  });
});

describe("conta técnica", () => {
  it("não tem senha: só existe a linha do usuário, sem forma de entrar, com o nome do gravador", async () => {
    const [u] = await db.select({ id: user.id, name: user.name }).from(user).where(eq(user.email, "a4cf129b1a2b@gravador.invalid"));
    expect(u?.name).toBe((await achar(P1.serie)).nome);
    expect(await db.select({ id: account.id }).from(account).where(eq(account.userId, u!.id))).toEqual([]);
  });
});
