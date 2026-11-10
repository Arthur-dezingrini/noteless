import {
  avesVivas,
  consolidarSemanas,
  criarInstalacaoSchema,
  criarLoteSchema,
  editarInstalacaoSchema,
  encerrarLoteSchema,
  faseLoteSchema,
  indicadoresDoDia,
  mortalidadeAlta,
  semanaDeVida,
  transferirLoteSchema,
  type ApontamentoDia,
  type FaseLote,
  type Instalacao,
  type LoteResumo,
  type Papel,
  type SituacaoLote,
} from "@vocare/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { alojamento, apontamentoAviario, instalacao, lote } from "../db/lotes";
import { hojeISO } from "../datas";
import { nomeDaInstalacao, sobrepoe } from "../lotes/alojamento";
import { membroAtual } from "../membros/membro-atual";

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

const SOMAVEIS = [
  "mortasFemeas",
  "mortasMachos",
  "eliminadasFemeas",
  "eliminadasMachos",
  "ovosTotal",
  "ovosIncubaveis",
  "racaoKg",
] as const;

function noDia(data: string, dias: number) {
  const [a = 0, m = 1, d = 1] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function somarLinhas(data: string, linhas: ApontamentoDia[]): ApontamentoDia {
  const soma: ApontamentoDia = { data, instalacaoId: "" };
  for (const l of linhas) for (const k of SOMAVEIS) if (l[k] != null) soma[k] = (soma[k] ?? 0) + (l[k] as number);
  return soma;
}

async function listarLotes(orgId: string, filtro: { situacao?: SituacaoLote; id?: string } = {}): Promise<LoteResumo[]> {
  const filtros = [eq(lote.organizationId, orgId)];
  if (filtro.situacao) filtros.push(eq(lote.situacao, filtro.situacao));
  if (filtro.id) filtros.push(eq(lote.id, filtro.id));
  const lotes = await db.select().from(lote).where(and(...filtros)).orderBy(asc(lote.codigo));
  if (lotes.length === 0) return [];
  const ids = lotes.map((l) => l.id);

  const aloj = await db
    .select({
      loteId: alojamento.loteId,
      instalacaoId: alojamento.instalacaoId,
      nome: instalacao.nome,
      inicio: alojamento.inicio,
      fim: alojamento.fim,
      femeas: alojamento.femeas,
      machos: alojamento.machos,
    })
    .from(alojamento)
    .innerJoin(instalacao, eq(instalacao.id, alojamento.instalacaoId))
    .where(inArray(alojamento.loteId, ids))
    .orderBy(asc(instalacao.nome));
  const linhas = await db.select().from(apontamentoAviario).where(inArray(apontamentoAviario.loteId, ids));

  const hoje = hojeISO();
  const ontem = noDia(hoje, -1);
  const num = (v: string | null) => (v === null ? null : Number(v));

  return lotes.map((l) => {
    const dele: ApontamentoDia[] = linhas
      .filter((a) => a.loteId === l.id)
      .map((a) => ({
        data: a.data,
        instalacaoId: a.instalacaoId,
        mortasFemeas: a.mortasFemeas,
        mortasMachos: a.mortasMachos,
        eliminadasFemeas: a.eliminadasFemeas,
        eliminadasMachos: a.eliminadasMachos,
        ovosTotal: a.ovosTotal,
        ovosIncubaveis: a.ovosIncubaveis,
        racaoKg: num(a.racaoKg),
      }));
    const iniciais = { femeas: l.femeasIniciais, machos: l.machosIniciais };
    const alojs = aloj.filter((a) => a.loteId === l.id);
    const abertos = alojs.filter((a) => a.fim === null);
    const galpoes = new Map((l.situacao === "ativo" ? abertos : alojs).map((a) => [a.instalacaoId, a.nome]));

    const doOntem = dele.filter((a) => a.data === ontem);
    const posturaOntemPct =
      doOntem.length === 0 ? null : indicadoresDoDia(somarLinhas(ontem, doOntem), avesVivas(iniciais, dele, noDia(ontem, -1))).posturaPct;

    const semana = semanaDeVida(l.dataAlojamento, l.idadeAlojamentoDias, hoje);
    const mortalidadeSemanaPct = consolidarSemanas(l, dele, []).find((s) => s.semana === semana)?.mortalidadePct ?? null;

    const doHoje = dele.filter((a) => a.data === hoje);
    const semApontamentoHoje =
      l.situacao === "ativo" &&
      abertos.some((a) => a.inicio <= hoje && !doHoje.some((d) => d.instalacaoId === a.instalacaoId));

    // Taxa de cada galpão sobre as aves dele no começo do dia.
    const mortalidadeAltaHoje = doHoje.some((ap) => {
      const a = alojs.find((x) => x.instalacaoId === ap.instalacaoId && x.inicio <= hoje && (x.fim === null || x.fim >= hoje));
      if (!a) return false;
      const antes = dele.filter((d) => d.instalacaoId === a.instalacaoId && d.data >= a.inicio && d.data < hoje);
      return mortalidadeAlta(ap, avesVivas({ femeas: a.femeas, machos: a.machos }, antes, noDia(hoje, -1)));
    });

    return {
      id: l.id,
      codigo: l.codigo,
      linhagem: l.linhagem,
      fase: l.fase as FaseLote,
      situacao: l.situacao as SituacaoLote,
      dataAlojamento: l.dataAlojamento,
      semana,
      galpoes: [...galpoes].map(([id, nome]) => ({ id, nome })),
      vivas: avesVivas(iniciais, dele, hoje),
      posturaOntemPct,
      mortalidadeSemanaPct,
      semApontamentoHoje,
      mortalidadeAltaHoje,
    };
  });
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
  if (data < alvo.dataAlojamento) {
    return c.json({ error: "A data de encerramento não pode ser antes do alojamento do lote." }, 422);
  }
  await db.transaction(async (tx) => {
    await tx.update(lote).set({ situacao: "encerrado", dataEncerramento: data }).where(eq(lote.id, id));
    await tx.update(alojamento).set({ fim: data }).where(and(eq(alojamento.loteId, id), isNull(alojamento.fim)));
  });
  const [atualizado] = await listarLotes(orgId, { id });
  return c.json(atualizado);
});
