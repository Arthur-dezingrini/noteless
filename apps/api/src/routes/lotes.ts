import {
  criarInstalacaoSchema,
  criarLoteSchema,
  editarInstalacaoSchema,
  encerrarLoteSchema,
  faseLoteSchema,
  pesagemLoteInputSchema,
  transferirLoteSchema,
  vacinacaoLoteInputSchema,
  valoresApontamentoSchema,
  type GalpaoHoje,
  type Instalacao,
  type Papel,
} from "@vocare/shared";
import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import { Hono } from "hono";

import { br, hojeISO, noDia } from "../base/datas";
import { db } from "../db";
import { alojamento, apontamentoAviario, instalacao, lote, pesagemLote, vacinacaoLote } from "../db/tabelas/aviario";
import { nomeDaInstalacao, sobrepoe } from "../lotes/alojamento";
import { substituirApontamento, validarApontamento } from "../lotes/apontamento";
import { montarFicha } from "../lotes/ficha";
import { listarLotes } from "../lotes/resumo";
import { membroAtual } from "../base/membro-atual";

/**
 * Aviário de matrizes. Qualquer membro lê; cadastrar e editar instalações é
 * do administrador.
 */
export const lotesRoutes = new Hono();

const PODE_SALVAR: Papel[] = ["owner", "admin"];
const SEM_ACESSO = "Sem acesso a esta organização.";
const SO_ADMIN = "Só o administrador cadastra ou edita instalações.";
const NOME_REPETIDO = "Já existe uma instalação com esse nome.";

async function listarInstalacoes(orgId: string, id?: string): Promise<Instalacao[]> {
  const filtros = [eq(instalacao.organizationId, orgId)];
  if (id) filtros.push(eq(instalacao.id, id));
  const linhas = await db
    .select({
      id: instalacao.id,
      nome: instalacao.nome,
      tipo: instalacao.tipo,
      capacidade: instalacao.capacidade,
      areaM2: instalacao.areaM2,
      ativa: instalacao.ativa,
      loteId: lote.id,
      loteCodigo: lote.codigo,
    })
    .from(instalacao)
    .leftJoin(alojamento, and(eq(alojamento.instalacaoId, instalacao.id), isNull(alojamento.fim)))
    .leftJoin(lote, eq(lote.id, alojamento.loteId))
    .where(and(...filtros))
    .orderBy(asc(instalacao.nome));
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo as Instalacao["tipo"],
    capacidade: l.capacidade,
    areaM2: l.areaM2 === null ? null : Number(l.areaM2),
    ativa: l.ativa,
    loteAtual: l.loteId && l.loteCodigo ? { id: l.loteId, codigo: l.loteCodigo } : null,
  }));
}

function nomeRepetido(e: unknown) {
  const erro = e as { code?: string; cause?: { code?: string } };
  return erro?.code === "23505" || erro?.cause?.code === "23505";
}

lotesRoutes.get("/:orgId/instalacoes", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  return c.json(await listarInstalacoes(orgId));
});

lotesRoutes.get("/:orgId/galpoes-hoje", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  const hoje = hojeISO();
  const linhas = await db
    .select({
      instalacaoId: instalacao.id,
      nome: instalacao.nome,
      loteId: lote.id,
      loteCodigo: lote.codigo,
      apontamentoId: apontamentoAviario.id,
    })
    .from(instalacao)
    .innerJoin(alojamento, and(eq(alojamento.instalacaoId, instalacao.id), isNull(alojamento.fim)))
    .innerJoin(lote, eq(lote.id, alojamento.loteId))
    .leftJoin(
      apontamentoAviario,
      and(eq(apontamentoAviario.instalacaoId, instalacao.id), eq(apontamentoAviario.data, hoje)),
    )
    .where(eq(instalacao.organizationId, orgId))
    .orderBy(asc(instalacao.nome));
  const resposta: GalpaoHoje[] = linhas.map((l) => ({
    instalacaoId: l.instalacaoId,
    nome: l.nome,
    loteId: l.loteId,
    loteCodigo: l.loteCodigo,
    apontado: l.apontamentoId !== null,
  }));
  return c.json(resposta);
});

lotesRoutes.post("/:orgId/instalacoes", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN }, 403);

  const body = criarInstalacaoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  try {
    const [nova] = await db
      .insert(instalacao)
      .values({
        organizationId: orgId,
        criadoPorId: eu.userId,
        nome: body.data.nome,
        tipo: body.data.tipo,
        capacidade: body.data.capacidade ?? null,
        areaM2: body.data.areaM2 == null ? null : String(body.data.areaM2),
      })
      .returning({ id: instalacao.id });
    const [criada] = await listarInstalacoes(orgId, nova!.id);
    return c.json(criada, 201);
  } catch (e) {
    if (nomeRepetido(e)) return c.json({ error: NOME_REPETIDO }, 409);
    throw e;
  }
});

lotesRoutes.patch("/:orgId/instalacoes/:id", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN }, 403);

  const body = editarInstalacaoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const { areaM2, ...resto } = body.data;
  const campos = {
    ...resto,
    ...(areaM2 === undefined ? {} : { areaM2: areaM2 === null ? null : String(areaM2) }),
  };
  // Só campos enviados são gravados; `undefined` o Drizzle ignora.
  try {
    const alvo =
      Object.keys(campos).length === 0
        ? await db.select({ id: instalacao.id }).from(instalacao).where(and(eq(instalacao.id, id), eq(instalacao.organizationId, orgId)))
        : await db
            .update(instalacao)
            .set(campos)
            .where(and(eq(instalacao.id, id), eq(instalacao.organizationId, orgId)))
            .returning({ id: instalacao.id });
    if (alvo.length === 0) return c.json({ error: "Instalação não encontrada." }, 404);
  } catch (e) {
    if (nomeRepetido(e)) return c.json({ error: NOME_REPETIDO }, 409);
    throw e;
  }
  const [atualizada] = await listarInstalacoes(orgId, id);
  return c.json(atualizada);
});

// Lotes

const SO_ADMIN_LOTE = "Só o administrador cria ou altera lotes.";
const SO_ADMIN_LANCA = "Só o administrador lança apontamentos, pesagens e vacinações.";
const CODIGO_REPETIDO = "Já existe um lote com esse código.";

/** Falha de regra dentro de uma transação: desfaz tudo e vira resposta HTTP. */
class FalhaLote extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    message: string,
  ) {
    super(message);
  }
}

lotesRoutes.get("/:orgId/lotes", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  const situacao = c.req.query("situacao");
  if (situacao !== undefined && situacao !== "ativo" && situacao !== "encerrado") {
    return c.json({ error: "Situação inválida. Use ativo ou encerrado." }, 400);
  }
  return c.json(await listarLotes(orgId, { situacao }));
});

lotesRoutes.post("/:orgId/lotes", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = criarLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  const dados = body.data;
  if (dados.dataAlojamento > hojeISO()) return c.json({ error: "Data no futuro." }, 422);

  try {
    const id = await db.transaction(async (tx) => {
      const [novo] = await tx
        .insert(lote)
        .values({
          organizationId: orgId,
          criadoPorId: eu.userId,
          codigo: dados.codigo,
          especie: dados.especie,
          linhagem: dados.linhagem ?? null,
          dataAlojamento: dados.dataAlojamento,
          idadeAlojamentoDias: dados.idadeAlojamentoDias,
          femeasIniciais: dados.galpoes.reduce((s, g) => s + g.femeas, 0),
          machosIniciais: dados.galpoes.reduce((s, g) => s + g.machos, 0),
          fase: dados.fase,
        })
        .returning({ id: lote.id });
      for (const g of dados.galpoes) {
        const nome = await nomeDaInstalacao(tx, orgId, g.instalacaoId);
        if (!nome) throw new FalhaLote(404, "Galpão não encontrado.");
        if (await sobrepoe(tx, g.instalacaoId, dados.dataAlojamento, null)) {
          throw new FalhaLote(409, `O ${nome} já tem lote alojado nesse período.`);
        }
        await tx.insert(alojamento).values({
          organizationId: orgId,
          criadoPorId: eu.userId,
          loteId: novo!.id,
          instalacaoId: g.instalacaoId,
          inicio: dados.dataAlojamento,
          femeas: g.femeas,
          machos: g.machos,
        });
      }
      return novo!.id;
    });
    return c.json({ id }, 201);
  } catch (e) {
    if (e instanceof FalhaLote) return c.json({ error: e.message }, e.status);
    if (nomeRepetido(e)) return c.json({ error: CODIGO_REPETIDO }, 409);
    throw e;
  }
});

/** Lote da organização, ou `null`. */
async function acharLote(orgId: string, id: string) {
  const [l] = await db.select().from(lote).where(and(eq(lote.id, id), eq(lote.organizationId, orgId)));
  return l ?? null;
}

lotesRoutes.post("/:orgId/lotes/:id/transferir", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = transferirLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  const { data, de, para, femeas, machos } = body.data;

  if (!(await acharLote(orgId, id))) return c.json({ error: "Lote não encontrado." }, 404);
  if (de === para) return c.json({ error: "Escolha um galpão de destino diferente do de origem." }, 422);
  if (data > hojeISO()) return c.json({ error: "Data no futuro." }, 422);

  try {
    await db.transaction(async (tx) => {
      const nomeDestino = await nomeDaInstalacao(tx, orgId, para);
      if (!nomeDestino) throw new FalhaLote(404, "Galpão de destino não encontrado.");
      const [aberto] = await tx
        .select()
        .from(alojamento)
        .where(and(eq(alojamento.loteId, id), eq(alojamento.instalacaoId, de), isNull(alojamento.fim)));
      if (!aberto) throw new FalhaLote(422, "Este lote não está alojado no galpão de origem. Confira o galpão escolhido.");
      if (data <= aberto.inicio) {
        throw new FalhaLote(422, "A data da transferência deve ser depois do início do alojamento no galpão de origem.");
      }
      if (await sobrepoe(tx, para, data, null)) {
        throw new FalhaLote(409, `O ${nomeDestino} já tem lote alojado nesse período.`);
      }
      // A transferência leva todas as aves do galpão: não passa do que está vivo lá.
      const baixas = await tx
        .select()
        .from(apontamentoAviario)
        .where(and(eq(apontamentoAviario.instalacaoId, de), gte(apontamentoAviario.data, aberto.inicio), lt(apontamentoAviario.data, data)));
      const soma = (f: (l: (typeof baixas)[number]) => number | null) => baixas.reduce((t, l) => t + (f(l) ?? 0), 0);
      const vivasF = aberto.femeas - soma((l) => (l.mortasFemeas ?? 0) + (l.eliminadasFemeas ?? 0));
      const vivasM = aberto.machos - soma((l) => (l.mortasMachos ?? 0) + (l.eliminadasMachos ?? 0));
      if (femeas > vivasF || machos > vivasM) {
        const nomeOrigem = (await nomeDaInstalacao(tx, orgId, de)) ?? "galpão de origem";
        throw new FalhaLote(
          422,
          `O ${nomeOrigem} tem ${vivasF} fêmeas e ${vivasM} machos vivos; não dá para transferir mais que isso.`,
        );
      }
      await tx.update(alojamento).set({ fim: noDia(data, -1) }).where(eq(alojamento.id, aberto.id));
      await tx.insert(alojamento).values({
        organizationId: orgId,
        criadoPorId: eu.userId,
        loteId: id,
        instalacaoId: para,
        inicio: data,
        femeas,
        machos,
      });
    });
  } catch (e) {
    if (e instanceof FalhaLote) return c.json({ error: e.message }, e.status);
    throw e;
  }
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

lotesRoutes.post("/:orgId/lotes/:id/fase", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = faseLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const alvo = await db
    .update(lote)
    .set({ fase: body.data.fase })
    .where(and(eq(lote.id, id), eq(lote.organizationId, orgId)))
    .returning({ id: lote.id });
  if (alvo.length === 0) return c.json({ error: "Lote não encontrado." }, 404);
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

lotesRoutes.post("/:orgId/lotes/:id/encerrar", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const body = encerrarLoteSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  const { data } = body.data;

  const alvo = await acharLote(orgId, id);
  if (!alvo) return c.json({ error: "Lote não encontrado." }, 404);
  if (data > hojeISO()) return c.json({ error: "Data no futuro." }, 422);
  if (data < alvo.dataAlojamento) {
    return c.json({ error: "A data de encerramento não pode ser antes do alojamento do lote." }, 422);
  }
  if (alvo.situacao === "encerrado") {
    return c.json({ error: `Este lote já foi encerrado em ${br(alvo.dataEncerramento ?? alvo.dataAlojamento)}.` }, 422);
  }
  const abertos = await db
    .select({ inicio: alojamento.inicio, nome: instalacao.nome })
    .from(alojamento)
    .innerJoin(instalacao, eq(instalacao.id, alojamento.instalacaoId))
    .where(and(eq(alojamento.loteId, id), isNull(alojamento.fim)));
  const recente = abertos.filter((a) => data < a.inicio).sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
  if (recente) {
    return c.json({ error: `A data de encerramento não pode ser antes de ${br(recente.inicio)}, quando o lote entrou no ${recente.nome}.` }, 422);
  }
  await db.transaction(async (tx) => {
    await tx.update(lote).set({ situacao: "encerrado", dataEncerramento: data }).where(eq(lote.id, id));
    await tx.update(alojamento).set({ fim: data }).where(and(eq(alojamento.loteId, id), isNull(alojamento.fim)));
  });
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

/**
 * Desfaz a última transferência: apaga o alojamento de destino e reabre o de
 * origem (o que terminou no dia anterior). Uma por chamada. Recusa se o
 * destino já tem lançamento depois da transferência — desfazer apagaria a
 * história — ou se a origem já recebeu outro lote.
 */
lotesRoutes.post("/:orgId/lotes/:id/desfazer-transferencia", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const alvo = await acharLote(orgId, id);
  if (!alvo) return c.json({ error: "Lote não encontrado." }, 404);
  if (alvo.situacao === "encerrado") return c.json({ error: "Reabra o lote antes de desfazer a transferência." }, 422);

  try {
    await db.transaction(async (tx) => {
      const todos = await tx.select().from(alojamento).where(eq(alojamento.loteId, id));
      const abertos = todos.filter((a) => a.fim === null).sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
      let par: { destino: (typeof todos)[number]; origem: (typeof todos)[number] } | null = null;
      for (const destino of abertos) {
        const origem = todos.find((a) => a.fim === noDia(destino.inicio, -1));
        if (origem) {
          par = { destino, origem };
          break;
        }
      }
      if (!par) throw new FalhaLote(422, "Este lote não tem transferência para desfazer.");
      const { destino, origem } = par;

      const [apontado] = await tx
        .select({ id: apontamentoAviario.id })
        .from(apontamentoAviario)
        .where(and(eq(apontamentoAviario.instalacaoId, destino.instalacaoId), eq(apontamentoAviario.loteId, id), gte(apontamentoAviario.data, destino.inicio)))
        .limit(1);
      const [pesado] = await tx
        .select({ id: pesagemLote.id })
        .from(pesagemLote)
        .where(and(eq(pesagemLote.instalacaoId, destino.instalacaoId), eq(pesagemLote.loteId, id), gte(pesagemLote.data, destino.inicio)))
        .limit(1);
      if (apontado || pesado) {
        const nome = (await nomeDaInstalacao(tx, orgId, destino.instalacaoId)) ?? "galpão de destino";
        throw new FalhaLote(
          422,
          `O ${nome} já tem apontamento ou pesagem depois da transferência. Apague ou corrija esses lançamentos antes de desfazer.`,
        );
      }
      if (await sobrepoe(tx, origem.instalacaoId, origem.inicio, null, origem.id)) {
        const nome = (await nomeDaInstalacao(tx, orgId, origem.instalacaoId)) ?? "galpão de origem";
        throw new FalhaLote(422, `O ${nome} já recebeu outro lote depois da transferência.`);
      }
      await tx.delete(alojamento).where(eq(alojamento.id, destino.id));
      await tx.update(alojamento).set({ fim: null }).where(eq(alojamento.id, origem.id));
    });
  } catch (e) {
    if (e instanceof FalhaLote) return c.json({ error: e.message }, e.status);
    throw e;
  }
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

/** Desfaz o encerramento: lote volta a ativo e os alojamentos fechados no dia reabrem. */
lotesRoutes.post("/:orgId/lotes/:id/reabrir", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LOTE }, 403);

  const alvo = await acharLote(orgId, id);
  if (!alvo) return c.json({ error: "Lote não encontrado." }, 404);
  if (alvo.situacao !== "encerrado" || !alvo.dataEncerramento) return c.json({ error: "Este lote não está encerrado." }, 422);
  const encerramento = alvo.dataEncerramento;

  try {
    await db.transaction(async (tx) => {
      const fechados = await tx
        .select()
        .from(alojamento)
        .where(and(eq(alojamento.loteId, id), eq(alojamento.fim, encerramento)));
      for (const a of fechados) {
        if (await sobrepoe(tx, a.instalacaoId, noDia(encerramento, 1), null, a.id)) {
          const nome = (await nomeDaInstalacao(tx, orgId, a.instalacaoId)) ?? "galpão";
          throw new FalhaLote(409, `O ${nome} já recebeu outro lote depois do encerramento.`);
        }
      }
      await tx.update(lote).set({ situacao: "ativo", dataEncerramento: null }).where(eq(lote.id, id));
      await tx.update(alojamento).set({ fim: null }).where(and(eq(alojamento.loteId, id), eq(alojamento.fim, encerramento)));
    });
  } catch (e) {
    if (e instanceof FalhaLote) return c.json({ error: e.message }, e.status);
    throw e;
  }
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataReal = (d: string) => DATA_ISO.test(d) && noDia(d, 0) === d;

lotesRoutes.get("/:orgId/lotes/:id", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: SEM_ACESSO }, 403);
  const ficha = await montarFicha(orgId, c.req.param("id"));
  if (!ficha) return c.json({ error: "Lote não encontrado." }, 404);
  return c.json(ficha);
});

lotesRoutes.put("/:orgId/lotes/:id/apontamentos/:instalacaoId/:data", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const instalacaoId = c.req.param("instalacaoId");
  const data = c.req.param("data");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LANCA }, 403);

  if (!dataReal(data)) return c.json({ error: "Data inválida." }, 400);
  const body = valoresApontamentoSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const alvo = await acharLote(orgId, id);
  if (!alvo) return c.json({ error: "Lote não encontrado." }, 404);
  if (!(await nomeDaInstalacao(db, orgId, instalacaoId))) return c.json({ error: "Galpão não encontrado." }, 404);

  try {
    await db.transaction(async (tx) => {
      const valida = await validarApontamento(tx, orgId, instalacaoId, data, body.data, "substituir");
      if (typeof valida === "string") throw new FalhaLote(422, valida);
      if (valida.loteId !== id) {
        const nome = await nomeDaInstalacao(tx, orgId, instalacaoId);
        throw new FalhaLote(422, `O ${nome} não tinha o lote ${alvo.codigo} em ${br(data)}. Confira o galpão e a data.`);
      }
      await substituirApontamento(tx, { organizationId: orgId, criadoPorId: eu.userId, ocorrenciaId: null }, instalacaoId, id, data, body.data);
    });
  } catch (e) {
    if (e instanceof FalhaLote) return c.json({ error: e.message }, e.status);
    throw e;
  }
  return c.json(await montarFicha(orgId, id));
});

lotesRoutes.post("/:orgId/lotes/:id/pesagens", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LANCA }, 403);

  const body = pesagemLoteInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  if (!dataReal(body.data.data)) return c.json({ error: "Data inválida." }, 400);
  const dados = body.data;

  const alvo = await acharLote(orgId, id);
  if (!alvo) return c.json({ error: "Lote não encontrado." }, 404);
  if (dados.instalacaoId && !(await nomeDaInstalacao(db, orgId, dados.instalacaoId))) {
    return c.json({ error: "Galpão não encontrado." }, 404);
  }
  if (dados.data > hojeISO()) return c.json({ error: "Data no futuro." }, 422);
  if (alvo.dataEncerramento && dados.data > alvo.dataEncerramento) {
    return c.json({ error: `O lote ${alvo.codigo} foi encerrado em ${br(alvo.dataEncerramento)}.` }, 422);
  }

  await db.insert(pesagemLote).values({
    organizationId: orgId,
    criadoPorId: eu.userId,
    loteId: id,
    instalacaoId: dados.instalacaoId ?? null,
    data: dados.data,
    sexo: dados.sexo,
    pesoMedioG: String(dados.pesoMedioG),
    uniformidadePct: dados.uniformidadePct == null ? null : String(dados.uniformidadePct),
    amostra: dados.amostra ?? null,
  });
  return c.json(await montarFicha(orgId, id), 201);
});

lotesRoutes.post("/:orgId/lotes/:id/vacinacoes", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: SEM_ACESSO }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN_LANCA }, 403);

  const body = vacinacaoLoteInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  if (!dataReal(body.data.data) || (body.data.proximaData && !dataReal(body.data.proximaData))) {
    return c.json({ error: "Data inválida." }, 400);
  }
  const dados = body.data;

  const alvo = await acharLote(orgId, id);
  if (!alvo) return c.json({ error: "Lote não encontrado." }, 404);
  if (dados.data > hojeISO()) return c.json({ error: "Data no futuro." }, 422);
  if (alvo.dataEncerramento && dados.data > alvo.dataEncerramento) {
    return c.json({ error: `O lote ${alvo.codigo} foi encerrado em ${br(alvo.dataEncerramento)}.` }, 422);
  }

  await db.insert(vacinacaoLote).values({
    organizationId: orgId,
    criadoPorId: eu.userId,
    loteId: id,
    vacina: dados.vacina,
    via: dados.via ?? null,
    data: dados.data,
    proximaData: dados.proximaData ?? null,
  });
  return c.json(await montarFicha(orgId, id), 201);
});
