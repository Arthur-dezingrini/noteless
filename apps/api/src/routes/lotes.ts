import { criarInstalacaoSchema, editarInstalacaoSchema, type Instalacao, type Papel } from "@vocare/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { alojamento, instalacao, lote } from "../db/lotes";
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
