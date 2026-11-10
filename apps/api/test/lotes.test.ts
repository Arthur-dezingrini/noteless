import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../src/db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../src/db/lotes";
import { fichaLoteSchema } from "@vocare/shared";
import { hojeISO, noDia } from "../src/datas";
import { loteNaData } from "../src/lotes/alojamento";
import { somarApontamento, validarApontamento } from "../src/lotes/apontamento";
import { chamar, criarFazenda } from "./ajuda";

describe("tabelas do aviário", () => {
  it("migration cria as tabelas do aviário", async () => {
    const f = await criarFazenda("Granja Teste");
    const [galpao] = (await db.insert(instalacao).values({ organizationId: f.orgId, nome: "Galpão 1", tipo: "galpao", capacidade: 5000, areaM2: "1200.50" }).returning()) as [typeof instalacao.$inferSelect];
    const [l] = (await db
      .insert(lote)
      .values({ organizationId: f.orgId, codigo: "L-001", especie: "galinha", dataAlojamento: "2026-01-05", femeasIniciais: 4000, machosIniciais: 400 })
      .returning()) as [typeof lote.$inferSelect];
    await db.insert(alojamento).values({ organizationId: f.orgId, loteId: l.id, instalacaoId: galpao.id, inicio: "2026-01-05", femeas: 4000, machos: 400 });
    await db.insert(apontamentoAviario).values({ organizationId: f.orgId, instalacaoId: galpao.id, loteId: l.id, data: "2026-02-01", ovosTotal: 3000, racaoKg: "480.5" });

    const lidos = await db.select().from(apontamentoAviario);
    expect(lidos).toHaveLength(1);
    expect(lidos[0]?.ovosTotal).toBe(3000);
    expect(l.fase).toBe("recria");
    expect(l.situacao).toBe("ativo");
    expect(l.idadeAlojamentoDias).toBe(0);
    expect(galpao.ativa).toBe(true);

    await expect(
      db.insert(apontamentoAviario).values({ organizationId: f.orgId, instalacaoId: galpao.id, loteId: l.id, data: "2026-02-01" }),
    ).rejects.toThrow();
  });
});

describe("rotas de instalações", () => {
  it("dono cria, lista com loteAtual; admin edita; membro só lê; outra fazenda não enxerga; nome repetido dá 409", async () => {
    const f = await criarFazenda("Granja Rotas");
    const outra = await criarFazenda("Outra Granja");
    const base = `/api/org/${f.orgId}/instalacoes`;

    const criada = await chamar(f.dono, "POST", base, { nome: "Galpão 1", tipo: "galpao", capacidade: 5000, areaM2: 1200.5 });
    expect(criada.status).toBe(201);
    expect(criada.json).toMatchObject({ nome: "Galpão 1", tipo: "galpao", capacidade: 5000, areaM2: 1200.5, ativa: true, loteAtual: null });

    const [l] = (await db
      .insert(lote)
      .values({ organizationId: f.orgId, codigo: "L-9", especie: "galinha", dataAlojamento: "2026-01-05", femeasIniciais: 10, machosIniciais: 1 })
      .returning()) as [typeof lote.$inferSelect];
    await db.insert(alojamento).values({ organizationId: f.orgId, loteId: l.id, instalacaoId: criada.json.id, inicio: "2026-01-05", femeas: 10, machos: 1 });
    await chamar(f.dono, "POST", base, { nome: "Baia A", tipo: "baia" });

    const lista = await chamar(f.membro, "GET", base);
    expect(lista.status).toBe(200);
    expect(lista.json.map((i: any) => i.nome)).toEqual(["Baia A", "Galpão 1"]);
    expect(lista.json[1].loteAtual).toEqual({ id: l.id, codigo: "L-9" });

    const editada = await chamar(f.admin, "PATCH", `${base}/${criada.json.id}`, { capacidade: 6000 });
    expect(editada.status).toBe(200);
    expect(editada.json).toMatchObject({ capacidade: 6000, nome: "Galpão 1" });

    expect((await chamar(f.membro, "POST", base, { nome: "X", tipo: "pasto" })).status).toBe(403);
    expect((await chamar(f.membro, "PATCH", `${base}/${criada.json.id}`, { capacidade: 1 })).status).toBe(403);

    const alheio = await chamar(outra.dono, "PATCH", `/api/org/${outra.orgId}/instalacoes/${criada.json.id}`, { capacidade: 1 });
    expect(alheio.status).toBe(404);
    expect((await chamar(outra.dono, "GET", `/api/org/${outra.orgId}/instalacoes`)).json).toEqual([]);
    expect((await chamar(outra.dono, "GET", base)).status).toBe(403);

    const repetida = await chamar(f.dono, "POST", base, { nome: "Galpão 1", tipo: "galpao" });
    expect(repetida.status).toBe(409);
    expect(repetida.json.error).toBe("Já existe uma instalação com esse nome.");
    const renomear = await chamar(f.dono, "PATCH", `${base}/${criada.json.id}`, { nome: "Baia A" });
    expect(renomear.status).toBe(409);

    expect((await chamar(f.dono, "POST", base, { nome: "", tipo: "galpao" })).status).toBe(400);
  });
});

describe("rotas de lotes e alojamento", () => {
  async function galpoes(f: Awaited<ReturnType<typeof criarFazenda>>, ...nomes: string[]) {
    const ids: string[] = [];
    for (const nome of nomes) ids.push((await chamar(f.dono, "POST", `/api/org/${f.orgId}/instalacoes`, { nome, tipo: "galpao" })).json.id);
    return ids;
  }
  const novo = (codigo: string, dataAlojamento: string, galpoes: { instalacaoId: string; femeas: number; machos: number }[]) => ({
    codigo,
    dataAlojamento,
    galpoes,
  });

  it("aloja o lote, lista com vivas e sem apontamento hoje; galpão ocupado e código repetido dão 409", async () => {
    const f = await criarFazenda("Granja Lotes");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1] = await galpoes(f, "Galpão 1");

    const criado = await chamar(f.dono, "POST", base, novo("L-01", "2026-01-05", [{ instalacaoId: g1!, femeas: 1000, machos: 100 }]));
    expect(criado.status).toBe(201);
    expect(typeof criado.json.id).toBe("string");

    const lista = await chamar(f.membro, "GET", `${base}?situacao=ativo`);
    expect(lista.status).toBe(200);
    expect(lista.json).toHaveLength(1);
    expect(lista.json[0]).toMatchObject({
      codigo: "L-01",
      fase: "recria",
      situacao: "ativo",
      vivas: { femeas: 1000, machos: 100 },
      galpoes: [{ id: g1, nome: "Galpão 1" }],
      posturaOntemPct: null,
      semApontamentoHoje: true,
      mortalidadeAltaHoje: false,
    });

    const ocupado = await chamar(f.dono, "POST", base, novo("L-02", "2026-02-01", [{ instalacaoId: g1!, femeas: 10, machos: 1 }]));
    expect(ocupado.status).toBe(409);
    expect(ocupado.json.error).toBe("O Galpão 1 já tem lote alojado nesse período.");
    // a transação desfez o lote L-02
    expect((await chamar(f.dono, "GET", base)).json).toHaveLength(1);

    const [g2] = await galpoes(f, "Galpão 2");
    const repetido = await chamar(f.dono, "POST", base, novo("L-01", "2026-01-05", [{ instalacaoId: g2!, femeas: 10, machos: 1 }]));
    expect(repetido.status).toBe(409);
    expect(repetido.json.error).toBe("Já existe um lote com esse código.");

    expect((await chamar(f.dono, "POST", base, { codigo: "", dataAlojamento: "2026-01-05", galpoes: [] })).status).toBe(400);
    expect((await chamar(f.dono, "GET", `${base}?situacao=x`)).status).toBe(400);
  });

  it("calcula postura de ontem, mortalidade alta e apontamento de hoje a partir dos apontamentos", async () => {
    const f = await criarFazenda("Granja Indicadores");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1, g2] = await galpoes(f, "Galpão 1", "Galpão 2");
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const ontem = new Date(new Date(`${hoje}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    const id = (
      await chamar(f.dono, "POST", base, novo("L-01", ontem, [
        { instalacaoId: g1!, femeas: 1000, machos: 100 },
        { instalacaoId: g2!, femeas: 1000, machos: 100 },
      ]))
    ).json.id;
    await db.insert(apontamentoAviario).values([
      { organizationId: f.orgId, instalacaoId: g1!, loteId: id, data: ontem, ovosTotal: 500 },
      { organizationId: f.orgId, instalacaoId: g2!, loteId: id, data: ontem, ovosTotal: 700 },
      { organizationId: f.orgId, instalacaoId: g1!, loteId: id, data: hoje, mortasFemeas: 5 },
    ]);
    const [l] = (await chamar(f.dono, "GET", base)).json;
    expect(l.posturaOntemPct).toBe(60); // 1200 ovos / 2000 fêmeas
    expect(l.mortalidadeAltaHoje).toBe(true); // 5 > 0,1% de 1100
    expect(l.semApontamentoHoje).toBe(true); // falta o Galpão 2
    expect(l.mortalidadeSemanaPct).toBeCloseTo(0.2, 1); // 5 de 2200
    expect(l.vivas).toEqual({ femeas: 1995, machos: 200 });
  });

  it("só dono/admin escreve; outra fazenda não enxerga o lote", async () => {
    const f = await criarFazenda("Granja Papéis");
    const outra = await criarFazenda("Outra Granja Lotes");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1, g2] = await galpoes(f, "Galpão 1", "Galpão 2");
    const corpo = novo("L-01", "2026-01-05", [{ instalacaoId: g1!, femeas: 10, machos: 1 }]);

    expect((await chamar(f.membro, "POST", base, corpo)).status).toBe(403);
    const id = (await chamar(f.admin, "POST", base, corpo)).json.id;

    const transf = { data: "2026-02-01", de: g1, para: g2, femeas: 10, machos: 1 };
    expect((await chamar(f.membro, "POST", `${base}/${id}/transferir`, transf)).status).toBe(403);
    expect((await chamar(f.membro, "POST", `${base}/${id}/fase`, { fase: "producao" })).status).toBe(403);
    expect((await chamar(f.membro, "POST", `${base}/${id}/encerrar`, { data: "2026-03-01" })).status).toBe(403);

    const alheio = await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/lotes/${id}/transferir`, transf);
    expect(alheio.status).toBe(404);
    expect((await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/lotes/${id}/fase`, { fase: "producao" })).status).toBe(404);
    expect((await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/lotes/${id}/encerrar`, { data: "2026-03-01" })).status).toBe(404);
    expect((await chamar(outra.dono, "GET", `/api/org/${outra.orgId}/lotes`)).json).toEqual([]);

    const fase = await chamar(f.admin, "POST", `${base}/${id}/fase`, { fase: "producao" });
    expect(fase.status).toBe(200);
    expect(fase.json.fase).toBe("producao");
  });

  it("transferência fecha a origem no dia anterior e libera o galpão para outro lote", async () => {
    const f = await criarFazenda("Granja Transferência");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1, g2] = await galpoes(f, "Galpão 1", "Galpão 2");
    const l1 = (await chamar(f.dono, "POST", base, novo("L-01", "2026-01-05", [{ instalacaoId: g1!, femeas: 1000, machos: 100 }]))).json.id;

    const naoAlojado = await chamar(f.dono, "POST", `${base}/${l1}/transferir`, { data: "2026-03-10", de: g2, para: g1, femeas: 1, machos: 1 });
    expect(naoAlojado.status).toBe(422);
    expect(naoAlojado.json.error).toMatch(/não está alojado/);

    const ok = await chamar(f.dono, "POST", `${base}/${l1}/transferir`, { data: "2026-03-10", de: g1, para: g2, femeas: 1000, machos: 100 });
    expect(ok.status).toBe(200);
    expect(ok.json.galpoes).toEqual([{ id: g2, nome: "Galpão 2" }]);

    const l2 = await chamar(f.dono, "POST", base, novo("L-02", "2026-03-10", [{ instalacaoId: g1!, femeas: 500, machos: 50 }]));
    expect(l2.status).toBe(201);

    expect((await loteNaData(db, f.orgId, g1!, "2026-03-09"))?.loteId).toBe(l1);
    expect((await loteNaData(db, f.orgId, g1!, "2026-03-10"))?.loteId).toBe(l2.json.id);
    expect((await loteNaData(db, f.orgId, g2!, "2026-03-10"))?.loteId).toBe(l1);
    expect(await loteNaData(db, f.orgId, g2!, "2026-03-09")).toBeNull();

    // destino ocupado
    const ocupado = await chamar(f.dono, "POST", `${base}/${l1}/transferir`, { data: "2026-04-01", de: g2, para: g1, femeas: 1, machos: 1 });
    expect(ocupado.status).toBe(409);
    expect((await chamar(f.dono, "POST", `${base}/${l1}/transferir`, { data: "2026-04-01", de: g2, para: g2, femeas: 1, machos: 1 })).status).toBe(422);
  });

  it("data no futuro dá 422 ao alojar, transferir e encerrar", async () => {
    const f = await criarFazenda("Granja Futuro");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1, g2] = await galpoes(f, "Galpão 1", "Galpão 2");
    const amanha = noDia(hojeISO(), 1);
    const criar = await chamar(f.dono, "POST", base, novo("L-F", amanha, [{ instalacaoId: g1!, femeas: 10, machos: 1 }]));
    expect(criar.status).toBe(422);
    expect(criar.json.error).toBe("Data no futuro.");
    const id = (await chamar(f.dono, "POST", base, novo("L-01", "2026-01-05", [{ instalacaoId: g1!, femeas: 10, machos: 1 }]))).json.id;
    const transf = await chamar(f.dono, "POST", `${base}/${id}/transferir`, { data: amanha, de: g1, para: g2, femeas: 10, machos: 1 });
    expect(transf.status).toBe(422);
    expect(transf.json.error).toBe("Data no futuro.");
    const enc = await chamar(f.dono, "POST", `${base}/${id}/encerrar`, { data: amanha });
    expect(enc.status).toBe(422);
    expect(enc.json.error).toBe("Data no futuro.");
    expect((await chamar(f.dono, "GET", `${base}?situacao=ativo`)).json).toHaveLength(1);
  });

  it("transferência não aceita mais aves do que as vivas no galpão de origem", async () => {
    const f = await criarFazenda("Granja Transf Vivas");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1, g2] = await galpoes(f, "Galpão 1", "Galpão 2");
    const id = (await chamar(f.dono, "POST", base, novo("L-01", "2026-01-05", [{ instalacaoId: g1!, femeas: 100, machos: 10 }]))).json.id;
    await chamar(f.dono, "PUT", `${base}/${id}/apontamentos/${g1}/2026-02-01`, { mortasFemeas: 20, eliminadasMachos: 2 });
    const demais = await chamar(f.dono, "POST", `${base}/${id}/transferir`, { data: "2026-03-10", de: g1, para: g2, femeas: 100, machos: 8 });
    expect(demais.status).toBe(422);
    expect(demais.json.error).toBe("O Galpão 1 tem 80 fêmeas e 8 machos vivos; não dá para transferir mais que isso.");
    expect((await chamar(f.dono, "GET", `${base}?situacao=ativo`)).json[0].galpoes).toEqual([{ id: g1, nome: "Galpão 1" }]);
    const ok = await chamar(f.dono, "POST", `${base}/${id}/transferir`, { data: "2026-03-10", de: g1, para: g2, femeas: 80, machos: 8 });
    expect(ok.status).toBe(200);
  });

  it("encerrar tira o lote de ativos, fecha os alojamentos e exige data depois do alojamento", async () => {
    const f = await criarFazenda("Granja Encerrar");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1] = await galpoes(f, "Galpão 1");
    const id = (await chamar(f.dono, "POST", base, novo("L-01", "2026-01-05", [{ instalacaoId: g1!, femeas: 10, machos: 1 }]))).json.id;

    const cedo = await chamar(f.dono, "POST", `${base}/${id}/encerrar`, { data: "2026-01-04" });
    expect(cedo.status).toBe(422);

    expect((await chamar(f.dono, "POST", `${base}/${id}/encerrar`, { data: "2026-06-01" })).status).toBe(200);
    expect((await chamar(f.dono, "GET", `${base}?situacao=ativo`)).json).toEqual([]);
    const enc = (await chamar(f.dono, "GET", `${base}?situacao=encerrado`)).json;
    expect(enc).toHaveLength(1);
    expect(enc[0]).toMatchObject({ codigo: "L-01", situacao: "encerrado", semApontamentoHoje: false });
    expect(await loteNaData(db, f.orgId, g1!, "2026-06-02")).toBeNull();
    expect((await loteNaData(db, f.orgId, g1!, "2026-06-01"))?.situacao).toBe("encerrado");
  });

  it("encerrar não aceita data antes da entrada no galpão atual nem lote já encerrado", async () => {
    const f = await criarFazenda("Granja Encerrar 2");
    const base = `/api/org/${f.orgId}/lotes`;
    const [g1, g2] = await galpoes(f, "Galpão 1", "Galpão 2");
    const id = (await chamar(f.dono, "POST", base, novo("L-01", "2026-01-05", [{ instalacaoId: g1!, femeas: 10, machos: 1 }]))).json.id;
    await chamar(f.dono, "POST", `${base}/${id}/transferir`, { data: "2026-03-10", de: g1, para: g2, femeas: 10, machos: 1 });

    const antes = await chamar(f.dono, "POST", `${base}/${id}/encerrar`, { data: "2026-03-05" });
    expect(antes.status).toBe(422);
    expect(antes.json.error).toBe("A data de encerramento não pode ser antes de 10/03, quando o lote entrou no Galpão 2.");
    expect((await chamar(f.dono, "GET", `${base}?situacao=ativo`)).json).toHaveLength(1);
    expect((await loteNaData(db, f.orgId, g2!, "2026-03-10"))?.situacao).toBe("ativo");

    expect((await chamar(f.dono, "POST", `${base}/${id}/encerrar`, { data: "2026-03-10" })).status).toBe(200);
    const de_novo = await chamar(f.dono, "POST", `${base}/${id}/encerrar`, { data: "2026-04-01" });
    expect(de_novo.status).toBe(422);
    expect(de_novo.json.error).toBe("Este lote já foi encerrado em 10/03.");
  });
});

describe("apontamento manual, pesagem, vacinação e ficha", () => {
  async function montar(nome: string) {
    const f = await criarFazenda(nome);
    const outra = await criarFazenda(`${nome} Outra`);
    const g1 = (await chamar(f.dono, "POST", `/api/org/${f.orgId}/instalacoes`, { nome: "Galpão 1", tipo: "galpao" })).json.id as string;
    const base = `/api/org/${f.orgId}/lotes`;
    const id = (await chamar(f.dono, "POST", base, { codigo: "L-01", dataAlojamento: "2026-01-05", galpoes: [{ instalacaoId: g1, femeas: 1000, machos: 100 }] })).json.id as string;
    const put = (quem: typeof f.dono, data: string, corpo: unknown, galpao = g1) => chamar(quem, "PUT", `${base}/${id}/apontamentos/${galpao}/${data}`, corpo);
    return { f, outra, g1, base, id, put };
  }

  it("PUT de 3 dias aparece na ficha; segundo PUT no mesmo dia substitui", async () => {
    const { f, base, id, put } = await montar("Granja Ficha");
    for (const [d, m] of [["2026-02-01", 2], ["2026-02-02", 3], ["2026-02-03", 4]] as const) {
      const r = await put(f.dono, d, { ovosTotal: 500, ovosIncubaveis: 450, racaoKg: 120.5, mortasFemeas: m });
      expect(r.status).toBe(200);
    }
    const r2 = await put(f.admin, "2026-02-03", { ovosTotal: 600, mortasFemeas: 1 });
    expect(r2.status).toBe(200);

    const g = await chamar(f.membro, "GET", `${base}/${id}`);
    expect(g.status).toBe(200);
    const ficha = fichaLoteSchema.parse(g.json);
    expect(ficha.indicadores.vivas.femeas).toBe(1000 - (2 + 3 + 1));
    expect(ficha.diario).toHaveLength(3);
    const dia3 = ficha.diario.find((d) => d.data === "2026-02-03")!;
    expect(dia3.valores).toMatchObject({ ovosTotal: 600, mortasFemeas: 1, racaoKg: null, ovosIncubaveis: null });
    expect(dia3.instalacaoNome).toBe("Galpão 1");
    expect(dia3.indicadores.posturaPct).toBe(60.3); // 600 / 995 fêmeas
    expect(ficha.lote).toMatchObject({ codigo: "L-01", femeasIniciais: 1000, dataEncerramento: null });
    expect(ficha.alojamentos).toHaveLength(1);
  });

  it("somarApontamento soma ao que o PUT gravou", async () => {
    const { f, g1, id, put } = await montar("Granja Somar");
    await put(f.dono, "2026-02-01", { mortasFemeas: 5, observacoes: "a" });
    const origem = { organizationId: f.orgId, criadoPorId: f.dono.id, ocorrenciaId: null };
    await somarApontamento(db, origem, g1, id, "2026-02-01", { mortasFemeas: 2, ovosTotal: 10, observacoes: "b" });
    const [linha] = await db.select().from(apontamentoAviario).where(eq(apontamentoAviario.loteId, id));
    expect(linha).toMatchObject({ mortasFemeas: 7, ovosTotal: 10, mortasMachos: null, observacoes: "a\nb" });
  });

  it("duas notas somadas com 300 caracteres de observação cada não quebram a ficha", async () => {
    const { f, g1, id, base, put } = await montar("Granja Obs Longa");
    await put(f.dono, "2026-02-01", { mortasFemeas: 1, observacoes: "a".repeat(300) });
    const origem = { organizationId: f.orgId, criadoPorId: f.dono.id, ocorrenciaId: null };
    await somarApontamento(db, origem, g1, id, "2026-02-01", { observacoes: "b".repeat(300) });
    await somarApontamento(db, origem, g1, id, "2026-02-01", { observacoes: "c".repeat(300) });
    const g = await chamar(f.membro, "GET", `${base}/${id}`);
    expect(g.status).toBe(200);
    const ficha = fichaLoteSchema.parse(g.json);
    expect(ficha.diario[0]!.valores.observacoes).toHaveLength(300 * 3 + 2);
  });

  it("rejeita data futura, galpão sem lote, lote encerrado, mais baixas que aves e ovos acima do total", async () => {
    const { f, base, id, g1, put } = await montar("Granja Regras");
    const futura = await put(f.dono, "2999-01-01", { ovosTotal: 1 });
    expect(futura.status).toBe(422);
    expect(futura.json.error).toBe("Data no futuro.");

    const antes = await put(f.dono, "2026-01-04", { ovosTotal: 1 });
    expect(antes.status).toBe(422);
    expect(antes.json.error).toBe("Galpão Galpão 1 não tem lote alojado em 04/01. Aloje o lote ou corrija o galpão.");

    const muitas = await put(f.dono, "2026-02-01", { mortasFemeas: 1001 });
    expect(muitas.status).toBe(422);
    expect(muitas.json.error).toBe("Mais aves mortas e eliminadas do que aves vivas no Galpão 1.");
    expect((await put(f.dono, "2026-02-01", { mortasFemeas: 600, eliminadasFemeas: 401 })).status).toBe(422);
    expect((await put(f.dono, "2026-02-01", { mortasMachos: 101 })).status).toBe(422);
    expect((await put(f.dono, "2026-02-01", { mortasFemeas: 1000 })).status).toBe(200);
    // as aves do dia anterior já saíram: no dia seguinte não há mais fêmeas
    expect((await put(f.dono, "2026-02-02", { mortasFemeas: 1 })).status).toBe(422);

    const ovos = await put(f.dono, "2026-02-03", { ovosTotal: 10, ovosIncubaveis: 8, ovosSujos: 3 });
    expect(ovos.status).toBe(400); // o Zod da rota pega primeiro; a IA (Task 7) passa por validarApontamento
    expect(ovos.json.error).toBe("A soma das classes de ovo passa do total.");
    expect(await validarApontamento(db, f.orgId, g1, "2026-02-03", { ovosTotal: 10, ovosIncubaveis: 8, ovosSujos: 3 }, "substituir")).toBe("A soma das classes de ovo passa do total.");
    expect((await put(f.dono, "2026-02-03", { ovosIncubaveis: 8, ovosSujos: 3 })).status).toBe(200);

    // modo somar: soma o que já existe antes de conferir
    await put(f.dono, "2026-02-04", { ovosTotal: 10, ovosIncubaveis: 8 });
    expect(await validarApontamento(db, f.orgId, g1, "2026-02-04", { ovosSujos: 3 }, "somar")).toBe("A soma das classes de ovo passa do total.");
    expect(await validarApontamento(db, f.orgId, g1, "2026-02-04", { ovosSujos: 2 }, "somar")).toEqual({ loteId: id });

    expect((await chamar(f.dono, "POST", `${base}/${id}/encerrar`, { data: "2026-03-01" })).status).toBe(200);
    const depois = await put(f.dono, "2026-03-02", { ovosTotal: 1 });
    expect(depois.status).toBe(422);
    expect(depois.json.error).toBe("O lote L-01 foi encerrado em 01/03.");
    const vac = await chamar(f.dono, "POST", `${base}/${id}/vacinacoes`, { data: "2026-03-02", vacina: "Newcastle" });
    expect(vac.status).toBe(422);
    expect(vac.json.error).toBe("O lote L-01 foi encerrado em 01/03.");
    const pes = await chamar(f.dono, "POST", `${base}/${id}/pesagens`, { data: "2026-03-02", sexo: "femea", pesoMedioG: 2850 });
    expect(pes.status).toBe(422);
    expect(pes.json.error).toBe("O lote L-01 foi encerrado em 01/03.");
    const falsa = await put(f.dono, "2026-02-30", { ovosTotal: 1 });
    expect(falsa.status).toBe(400);
    expect(falsa.json.error).toBe("Data inválida.");
    expect((await chamar(f.dono, "POST", `${base}/${id}/vacinacoes`, { data: "2026-03-01", vacina: "Newcastle", via: "ocular" })).status).toBe(201);
  });

  it("aves vivas do galpão contam só o alojamento daquele galpão (transferência)", async () => {
    const { f, base, id, g1, put } = await montar("Granja Transfer");
    const g2 = (await chamar(f.dono, "POST", `/api/org/${f.orgId}/instalacoes`, { nome: "Galpão 2", tipo: "galpao" })).json.id as string;
    await put(f.dono, "2026-02-01", { mortasFemeas: 100 });
    await chamar(f.dono, "POST", `${base}/${id}/transferir`, { data: "2026-02-10", de: g1, para: g2, femeas: 50, machos: 10 });
    expect((await put(f.dono, "2026-02-11", { mortasFemeas: 51 }, g2)).status).toBe(422);
    expect((await put(f.dono, "2026-02-11", { mortasFemeas: 50 }, g2)).status).toBe(200);
    // lote inexistente nesse galpão/dia
    const outro = await chamar(f.dono, "PUT", `${base}/00000000-0000-0000-0000-000000000000/apontamentos/${g2}/2026-02-11`, { ovosTotal: 1 });
    expect(outro.status).toBe(404);
  });

  it("só dono/admin lança; membro lê; outra fazenda não enxerga", async () => {
    const { f, outra, base, id, put } = await montar("Granja Acesso");
    expect((await put(f.membro, "2026-02-01", { ovosTotal: 1 })).status).toBe(403);
    expect((await chamar(f.membro, "POST", `${base}/${id}/pesagens`, { data: "2026-02-01", sexo: "femea", pesoMedioG: 2850 })).status).toBe(403);
    expect((await chamar(f.membro, "POST", `${base}/${id}/vacinacoes`, { data: "2026-02-01", vacina: "X" })).status).toBe(403);
    expect((await chamar(f.membro, "GET", `${base}/${id}`)).status).toBe(200);
    expect((await chamar(outra.dono, "GET", `/api/org/${outra.orgId}/lotes/${id}`)).status).toBe(404);
    expect((await chamar(outra.dono, "POST", `/api/org/${outra.orgId}/lotes/${id}/pesagens`, { data: "2026-02-01", sexo: "femea", pesoMedioG: 2850 })).status).toBe(404);
    expect((await chamar(f.dono, "POST", `${base}/${id}/pesagens`, { data: "2026-02-01", sexo: "femea", pesoMedioG: -1 })).status).toBe(400);
  });

  it("vacinação com data no futuro dá 422; próxima data futura é aceita", async () => {
    const { f, base, id } = await montar("Granja Vac Futura");
    const amanha = noDia(hojeISO(), 1);
    const r = await chamar(f.dono, "POST", `${base}/${id}/vacinacoes`, { data: amanha, vacina: "Newcastle" });
    expect(r.status).toBe(422);
    expect(r.json.error).toBe("Data no futuro.");
    expect((await chamar(f.dono, "POST", `${base}/${id}/vacinacoes`, { data: "2026-02-01", vacina: "Newcastle", proximaData: amanha })).status).toBe(201);
  });

  it("pesagem de fêmeas aparece na semana; vacinação na ficha", async () => {
    const { f, base, id, put } = await montar("Granja Pesagem");
    await put(f.dono, "2026-01-06", { mortasFemeas: 1 });
    const p = await chamar(f.dono, "POST", `${base}/${id}/pesagens`, { data: "2026-01-07", sexo: "femea", pesoMedioG: 2850, uniformidadePct: 82 });
    expect(p.status).toBe(201);
    await chamar(f.dono, "POST", `${base}/${id}/vacinacoes`, { data: "2026-01-08", vacina: "Gumboro", proximaData: "2026-01-29" });
    const ficha = fichaLoteSchema.parse((await chamar(f.dono, "GET", `${base}/${id}`)).json);
    expect(ficha.semanal[0]).toMatchObject({ semana: 1, pesoFemeaG: 2850, uniformidadeFemeaPct: 82 });
    expect(ficha.pesagens).toHaveLength(1);
    expect(ficha.vacinacoes[0]).toMatchObject({ vacina: "Gumboro", proximaData: "2026-01-29" });
  });
});

describe("galpões hoje", () => {
  it("lista galpões com lote aberto e se já foram apontados hoje; sem lote não aparece; outra fazenda não vê", async () => {
    const f = await criarFazenda("Granja Hoje");
    const outra = await criarFazenda("Outra Granja Hoje");
    const mk = async (nome: string) => (await chamar(f.dono, "POST", `/api/org/${f.orgId}/instalacoes`, { nome, tipo: "galpao" })).json.id as string;
    const [g1, g2] = [await mk("Galpão 1"), await mk("Galpão 2")];
    await mk("Galpão 3");
    const l1 = await chamar(f.dono, "POST", `/api/org/${f.orgId}/lotes`, { codigo: "L-01", dataAlojamento: "2026-01-05", galpoes: [{ instalacaoId: g1, femeas: 100, machos: 10 }] });
    const l2 = await chamar(f.dono, "POST", `/api/org/${f.orgId}/lotes`, { codigo: "L-02", dataAlojamento: "2026-01-05", galpoes: [{ instalacaoId: g2, femeas: 100, machos: 10 }] });
    expect(l1.status).toBe(201);
    expect(l2.status).toBe(201);

    const put = await chamar(f.dono, "PUT", `/api/org/${f.orgId}/lotes/${l1.json.id}/apontamentos/${g1}/${hojeISO()}`, { ovosTotal: 50 });
    expect(put.status).toBe(200);

    const res = await chamar(f.membro, "GET", `/api/org/${f.orgId}/galpoes-hoje`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      { instalacaoId: g1, nome: "Galpão 1", loteId: l1.json.id, loteCodigo: "L-01", apontado: true },
      { instalacaoId: g2, nome: "Galpão 2", loteId: l2.json.id, loteCodigo: "L-02", apontado: false },
    ]);

    expect((await chamar(outra.dono, "GET", `/api/org/${outra.orgId}/galpoes-hoje`)).json).toEqual([]);
    expect((await chamar(outra.dono, "GET", `/api/org/${f.orgId}/galpoes-hoje`)).status).toBe(403);
  });
});
