import { describe, expect, it } from "vitest";

import { db } from "../src/db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../src/db/lotes";
import { loteNaData } from "../src/lotes/alojamento";
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
