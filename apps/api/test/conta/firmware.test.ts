import { createHash, generateKeyPairSync, verify } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../../src/app";
import { codigoDePareamento } from "../../src/base/gravador-atual";
import { env } from "../../src/env";
import { chamar, criarFazenda, criarSuper, type Pessoa } from "../ajuda";

type Fazenda = Awaited<ReturnType<typeof criarFazenda>>;
type Placa = { serie: string; segredo: string };

const chaves = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const CHAVE_PRIVADA = chaves.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

let a: Fazenda;
let sup: Pessoa;
const P1: Placa = { serie: "70:4B:CA:04:72:64", segredo: "b1".repeat(32) };
const P2: Placa = { serie: "70:4B:CA:04:99:01", segredo: "b2".repeat(32) };

/** Um .bin de ESP32 de mentira: o byte mágico 0xE9 na frente e a marca da versão no meio. */
function binario(versao: string | null, tamanho = 4096, magico = 0xe9) {
  const b = new Uint8Array(tamanho);
  for (let i = 0; i < tamanho; i++) b[i] = (i * 31 + 7) & 0xff;
  b[0] = magico;
  if (versao) b.set([...Buffer.from(`NOTELESS_FW_VERSAO=${versao}\0`)], 1000);
  return b;
}
const V110 = binario("1.1.0");

async function pedir(caminho: string, init: RequestInit = {}) {
  const res = await app.request(caminho, init);
  return res;
}
const credencial = (p: Placa) => `Gravador ${p.serie} ${p.segredo}`;
const estado = (p: Placa, extra: Record<string, unknown> = {}) => ({
  serie: p.serie,
  versao: "1.0.0",
  wifi: { rede: "x", sinalDbm: -60, ip: "10.0.0.2" },
  fila: 0,
  recusadas: 0,
  cartao: { ok: true, livreGb: 29 },
  ultimoErro: null,
  boot: { motivo: "ligada na energia", haSeg: 10 },
  ...extra,
});
async function avisar(p: Placa, extra: Record<string, unknown> = {}) {
  const res = await pedir("/api/gravadores/estado", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: credencial(p) },
    body: JSON.stringify(estado(p, extra)),
  });
  return { status: res.status, json: (await res.json()) as any };
}
async function publicar(quem: Pessoa | null, bin: Uint8Array) {
  const form = new FormData();
  form.set("firmware", new File([bin], "gravador.ino.bin", { type: "application/octet-stream" }));
  const res = await pedir("/api/admin/gravadores/firmware", { method: "POST", headers: quem ? { Cookie: quem.cookie } : {}, body: form });
  return { status: res.status, json: (await res.json()) as any };
}
const baixar = (p: Placa | null, versao: string, range?: string, authorization = p ? credencial(p) : undefined) =>
  pedir(`/api/gravadores/firmware/${versao}`, {
    headers: { ...(authorization ? { Authorization: authorization } : {}), ...(range ? { Range: range } : {}) },
  });
const idDe = async (p: Placa) => ((await chamar(sup, "GET", "/api/admin/gravadores")).json as { id: string; serie: string }[]).find((g) => g.serie === p.serie)!.id;

beforeAll(async () => {
  env.FIRMWARE_CHAVE_PRIVADA = CHAVE_PRIVADA;
  a = await criarFazenda("Granja Firmware");
  sup = await criarSuper();
  for (const p of [P1, P2]) {
    await avisar(p);
    const r = await chamar(sup, "POST", `/api/admin/gravadores/${await idDe(p)}/aprovar`, {
      codigo: codigoDePareamento(p.segredo),
      organizationId: a.orgId,
    });
    expect(r.status).toBe(200);
  }
});
afterAll(() => {
  env.FIRMWARE_CHAVE_PRIVADA = undefined;
});

describe("publicar firmware", () => {
  it("só o super usuário publica; sem a chave no servidor, 503", async () => {
    expect((await publicar(null, V110)).status).toBe(401);
    expect((await publicar(a.dono, V110)).status).toBe(403);
    env.FIRMWARE_CHAVE_PRIVADA = undefined;
    expect((await publicar(sup, V110)).status).toBe(503);
    env.FIRMWARE_CHAVE_PRIVADA = CHAVE_PRIVADA;
  });

  it("recusa o que não é firmware da ESP32 ou não traz a versão", async () => {
    expect((await publicar(sup, binario("1.1.0", 4096, 0x00))).status).toBe(400);
    const r = await publicar(sup, binario(null));
    expect(r.status).toBe(400);
    expect(r.json.error).toContain("NOTELESS_FW_VERSAO");
  });

  it("lê a versão de dentro do arquivo, guarda tamanho e SHA-256; a mesma versão de novo é 409", async () => {
    const r = await publicar(sup, V110);
    expect(r.status).toBe(201);
    expect(r.json).toEqual({ versao: "1.1.0", tamanho: 4096, sha256: createHash("sha256").update(V110).digest("hex") });
    expect((await publicar(sup, V110)).status).toBe(409);
    const lista = (await chamar(sup, "GET", "/api/admin/gravadores/firmware")).json;
    expect(lista).toEqual([expect.objectContaining({ versao: "1.1.0", tamanho: 4096 })]);
  });
});

describe("oferecer e baixar", () => {
  it("versão que não existe não vira alvo (404); quem não é super não escolhe", async () => {
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${await idDe(P1)}`, { firmwareAlvo: "9.9.9" })).status).toBe(404);
    expect((await chamar(a.dono, "PATCH", `/api/admin/gravadores/${await idDe(P1)}`, { firmwareAlvo: "1.1.0" })).status).toBe(403);
  });

  it("o aviso oferece a versão-alvo à placa que está em outra, com assinatura que confere; sem chave 'id'", async () => {
    expect((await avisar(P1)).json.firmware).toBeNull();
    expect((await chamar(sup, "PATCH", `/api/admin/gravadores/${await idDe(P1)}`, { firmwareAlvo: "1.1.0" })).status).toBe(200);

    const oferta = (await avisar(P1)).json.firmware;
    expect(oferta).toMatchObject({ versao: "1.1.0", tamanho: 4096, sha256: createHash("sha256").update(V110).digest("hex") });
    expect(Object.keys(oferta)).not.toContain("id");
    expect(verify("sha256", V110, chaves.publicKey, Buffer.from(oferta.assinatura, "base64"))).toBe(true);

    // Já na versão nova: nada a oferecer.
    expect((await avisar(P1, { versao: "1.1.0" })).json.firmware).toBeNull();
  });

  it("a placa-alvo baixa em pedaços (Range) ou inteiro", async () => {
    const r1 = await baixar(P1, "1.1.0", "bytes=0-1023");
    expect(r1.status).toBe(206);
    expect(r1.headers.get("content-range")).toBe("bytes 0-1023/4096");
    expect(new Uint8Array(await r1.arrayBuffer())).toEqual(V110.subarray(0, 1024));

    const r2 = await baixar(P1, "1.1.0", "bytes=4000-");
    expect(r2.status).toBe(206);
    expect(new Uint8Array(await r2.arrayBuffer())).toEqual(V110.subarray(4000));

    const r3 = await baixar(P1, "1.1.0");
    expect(r3.status).toBe(200);
    expect(new Uint8Array(await r3.arrayBuffer())).toEqual(V110);

    expect((await baixar(P1, "1.1.0", "bytes=5000-")).status).toBe(416);
  });

  it("outra placa, segredo errado, sem credencial ou versão que não é o alvo: não baixa", async () => {
    expect((await baixar(P2, "1.1.0", "bytes=0-10")).status).toBe(403);
    expect((await baixar(null, "1.1.0", "bytes=0-10")).status).toBe(401);
    expect((await baixar(P1, "1.1.0", "bytes=0-10", `Gravador ${P1.serie} ${"c3".repeat(32)}`)).status).toBe(403);
    expect((await baixar(P1, "9.9.9", "bytes=0-10")).status).toBe(403);
  });

  it("'todas as placas' põe a versão como alvo de todas as aprovadas", async () => {
    expect((await chamar(a.dono, "POST", "/api/admin/gravadores/firmware/1.1.0/todas")).status).toBe(403);
    expect((await chamar(sup, "POST", "/api/admin/gravadores/firmware/9.9.9/todas")).status).toBe(404);
    const r = await chamar(sup, "POST", "/api/admin/gravadores/firmware/1.1.0/todas");
    expect(r.status).toBe(200);
    expect(r.json.placas).toBeGreaterThanOrEqual(2);
    expect((await avisar(P2)).json.firmware).toMatchObject({ versao: "1.1.0" });
    expect((await baixar(P2, "1.1.0", "bytes=0-10")).status).toBe(206);
  });

  it("o andamento que a placa conta fica no estado, para a tela", async () => {
    await avisar(P1, { atualizacao: { versao: "1.1.0", etapa: "baixando", progresso: 40, erro: null } });
    const g = ((await chamar(sup, "GET", "/api/admin/gravadores")).json as any[]).find((x) => x.serie === P1.serie);
    expect(g.firmwareAlvo).toBe("1.1.0");
    expect(g.estado.atualizacao).toEqual({ versao: "1.1.0", etapa: "baixando", progresso: 40, erro: null });
  });
});
