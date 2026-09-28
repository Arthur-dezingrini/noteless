import {
  confirmarOcorrenciaSchema,
  corrigirOperacao,
  operacaoSchema,
  statusOcorrenciaSchema,
  textoOcorrenciaSchema,
  type Ocorrencia,
  type Operacao,
  type Papel,
} from "@vocare/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db";
import { animal } from "../db/animais";
import { consulta } from "../db/consultas";
import { anotacaoAnimal, ocorrencia } from "../db/ocorrencias";
import { user } from "../db/schema";
import { analisar } from "../ia/analisar";
import { IaNaoConfigurada, transcrever } from "../ia/transcrever";
import { membroAtual } from "../membros/membro-atual";

/**
 * Registros de ocorrência: áudio entra, IA propõe, humano confirma. Qualquer
 * membro grava e confere; salvar (aplicar ao sistema) ou descartar é do
 * administrador — o membro manda para ele.
 */
export const ocorrenciasRoutes = new Hono();

const PODE_SALVAR: Papel[] = ["owner", "admin"];
const SO_ADMIN = "Só o administrador salva ou descarta ocorrências. Use \"Mandar para o administrador\".";

const TAMANHO_MAXIMO = 25 * 1024 * 1024; // limite do Whisper
const HORA_PADRAO = "08:00";

class AplicacaoFalhou extends Error {}

/** "AAAA-MM-DD" de hoje em São Paulo — a IA precisa saber que dia é. */
function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const criador = alias(user, "criador");
const revisor = alias(user, "revisor");
const encaminhador = alias(user, "encaminhador");

const colunas = {
  id: ocorrencia.id,
  status: ocorrencia.status,
  transcricao: ocorrencia.transcricao,
  resumo: ocorrencia.resumo,
  duracaoSeg: ocorrencia.duracaoSeg,
  operacoes: ocorrencia.operacoes,
  criadoPorNome: criador.name,
  createdAt: ocorrencia.createdAt,
  revisadoPorNome: revisor.name,
  revisadoEm: ocorrencia.revisadoEm,
  encaminhadaPorNome: encaminhador.name,
  encaminhadaEm: ocorrencia.encaminhadaEm,
};

type Linha = { [K in keyof typeof colunas]: (typeof colunas)[K]["_"]["data"] | null };

/** Linha → contrato. O JSON de operações é validado aqui; item inválido some. */
function paraContrato(r: Linha): Ocorrencia {
  const ops = z.array(z.unknown()).catch([]).parse(r.operacoes);
  return {
    id: r.id!,
    status: statusOcorrenciaSchema.catch("pendente").parse(r.status),
    transcricao: r.transcricao ?? "",
    resumo: r.resumo ?? "",
    duracaoSeg: r.duracaoSeg,
    operacoes: ops.map((o) => operacaoSchema.safeParse(o)).flatMap((p) => (p.success ? [p.data] : [])),
    criadoPorNome: r.criadoPorNome ?? "—",
    createdAt: r.createdAt!,
    revisadoPorNome: r.revisadoPorNome,
    revisadoEm: r.revisadoEm,
    encaminhadaPorNome: r.encaminhadaPorNome,
    encaminhadaEm: r.encaminhadaEm,
  };
}

async function buscar(orgId: string, id?: string) {
  const filtros = [eq(ocorrencia.organizationId, orgId)];
  if (id) filtros.push(eq(ocorrencia.id, id));
  const rows = await db
    .select(colunas)
    .from(ocorrencia)
    .leftJoin(criador, eq(criador.id, ocorrencia.criadoPorId))
    .leftJoin(revisor, eq(revisor.id, ocorrencia.revisadoPorId))
    .leftJoin(encaminhador, eq(encaminhador.id, ocorrencia.encaminhadaPorId))
    .where(and(...filtros))
    .orderBy(desc(ocorrencia.createdAt));
  return rows.map(paraContrato);
}

ocorrenciasRoutes.get("/:orgId/ocorrencias", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  return c.json(await buscar(orgId));
});

/**
 * Recebe o áudio (multipart, campo `audio`), transcreve, interpreta e guarda
 * como pendente. Devolve a ocorrência pronta para a tela mostrar.
 */
ocorrenciasRoutes.post("/:orgId/ocorrencias", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = await c.req.parseBody().catch(() => null);
  const audio = body?.audio;
  if (!(audio instanceof File) || audio.size === 0) return c.json({ error: "Envie um áudio no campo 'audio'." }, 400);
  if (audio.size > TAMANHO_MAXIMO) return c.json({ error: "Áudio grande demais (máximo 25 MB)." }, 413);
  const duracaoSeg = Number(body?.duracaoSeg) || null;

  try {
    const transcricao = await transcrever(audio);
    // Áudio que não deu para entender vira ocorrência mesmo assim: quem
    // confere escreve o que foi dito (POST /:id/texto).
    const analise = transcricao ? await analisar(transcricao, hojeISO(), await animaisDaOrg(orgId)) : null;

    const [nova] = await db
      .insert(ocorrencia)
      .values({
        organizationId: orgId,
        criadoPorId: eu.userId,
        transcricao,
        resumo: analise?.resumo ?? "",
        duracaoSeg,
        operacoes: analise?.operacoes ?? [],
      })
      .returning({ id: ocorrencia.id });

    const [pronta] = await buscar(orgId, nova!.id);
    return c.json(pronta, 201);
  } catch (e) {
    if (e instanceof IaNaoConfigurada) return c.json({ error: e.message }, 503);
    console.error("[ocorrencias] falha no pipeline de áudio:", e);
    return c.json({ error: "A IA não conseguiu processar o áudio agora. Tente de novo em instantes." }, 502);
  }
});

/** Animais ativos da organização — o contexto que a IA usa para ligar nomes a ids. */
function animaisDaOrg(orgId: string) {
  return db
    .select({ id: animal.id, nome: animal.nome, especie: animal.especie, raca: animal.raca, tutor: animal.tutor })
    .from(animal)
    .where(and(eq(animal.organizationId, orgId), eq(animal.status, "ativo")))
    .orderBy(asc(animal.nome));
}

/**
 * Áudio não entendido (ou mal entendido): o texto escrito substitui a
 * transcrição e a IA interpreta de novo. Só enquanto está para conferir.
 */
ocorrenciasRoutes.post("/:orgId/ocorrencias/:id/texto", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = textoOcorrenciaSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const [alvo] = await buscar(orgId, id);
  if (!alvo) return c.json({ error: "Ocorrência não encontrada." }, 404);
  if (alvo.status !== "pendente") return c.json({ error: "Esta ocorrência já foi revisada." }, 409);

  try {
    const analise = await analisar(body.data.texto, hojeISO(), await animaisDaOrg(orgId));
    await db
      .update(ocorrencia)
      .set({ transcricao: body.data.texto, resumo: analise.resumo, operacoes: analise.operacoes })
      .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizationId, orgId)));
  } catch (e) {
    if (e instanceof IaNaoConfigurada) return c.json({ error: e.message }, 503);
    console.error("[ocorrencias] falha ao interpretar texto:", e);
    return c.json({ error: "A IA não conseguiu interpretar o texto agora. Tente de novo em instantes." }, 502);
  }

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});

/** Membro conferiu e passa para o administrador salvar. */
ocorrenciasRoutes.post("/:orgId/ocorrencias/:id/encaminhar", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const [alvo] = await db
    .update(ocorrencia)
    .set({ encaminhadaPorId: eu.userId, encaminhadaEm: new Date() })
    .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizationId, orgId), eq(ocorrencia.status, "pendente")))
    .returning({ id: ocorrencia.id });
  if (!alvo) return c.json({ error: "Ocorrência não encontrada ou já revisada." }, 404);

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});

/**
 * Aplica uma operação já confirmada. Tudo aqui exige animal do cadastro —
 * quem não tem animalId nem chega a ser selecionável na tela.
 */
async function aplicar(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], op: Operacao, orgId: string, userId: string, ocorrenciaId: string) {
  if (!op.animalId) return "Operação sem animal do cadastro não pode ser aplicada.";

  const [a] = await tx
    .select({ id: animal.id })
    .from(animal)
    .where(and(eq(animal.id, op.animalId), eq(animal.organizationId, orgId)))
    .limit(1);
  if (!a) return "Animal não encontrado nesta organização.";

  switch (op.tipo) {
    case "agendar_consulta":
      await tx.insert(consulta).values({
        organizationId: orgId,
        animalId: op.animalId,
        data: op.data ?? hojeISO(),
        hora: op.hora ?? HORA_PADRAO,
        tipo: op.tipoConsulta,
        observacoes: op.observacoes ?? op.detalhe,
      });
      return null;
    case "registrar_anotacao":
      await tx.insert(anotacaoAnimal).values({
        organizationId: orgId,
        animalId: op.animalId,
        ocorrenciaId,
        criadoPorId: userId,
        texto: op.texto,
      });
      return null;
    case "registrar_peso":
      await tx.update(animal).set({ pesoKg: String(op.pesoKg) }).where(eq(animal.id, op.animalId));
      return null;
  }
}

ocorrenciasRoutes.post("/:orgId/ocorrencias/:id/confirmar", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN }, 403);

  const body = confirmarOcorrenciaSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.issues[0]?.message ?? "Dados inválidos." }, 400);

  const [alvo] = await buscar(orgId, id);
  if (!alvo) return c.json({ error: "Ocorrência não encontrada." }, 404);
  if (alvo.status !== "pendente") return c.json({ error: "Esta ocorrência já foi revisada." }, 409);

  // Correções de quem conferiu entram antes de aplicar; o valor da IA fica
  // em `original` de cada operação (trilha de auditoria).
  const corrigidas: Operacao[] = [];
  for (const [i, op] of alvo.operacoes.entries()) {
    const r = corrigirOperacao(op, body.data.correcoes?.[String(i)]);
    if (!r.ok) return c.json({ error: `${r.error} (ação ${i + 1})` }, 400);
    corrigidas.push(r.op);
  }

  const indices = new Set(body.data.operacoes);
  const escolhidas = corrigidas.filter((_, i) => indices.has(i));
  // Fica registrado o que foi proposto, o que foi corrigido e o que de fato entrou.
  const marcadas = corrigidas.map((op, i) => ({ ...op, aplicada: indices.has(i) }));

  // Tudo ou nada: se uma operação falha, nenhuma é gravada e a ocorrência
  // continua pendente para o revisor ajustar.
  const erro = await db.transaction(async (tx) => {
    for (const op of escolhidas) {
      const e = await aplicar(tx, op, orgId, eu.userId, id);
      // Lançar desfaz a transação; a mensagem volta para o revisor.
      if (e) throw new AplicacaoFalhou(e);
    }
    await tx
      .update(ocorrencia)
      .set({ status: "confirmada", revisadoPorId: eu.userId, revisadoEm: new Date(), operacoes: marcadas })
      .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizationId, orgId)));
    return null;
  }).catch((e: unknown) => {
    if (e instanceof AplicacaoFalhou) return e.message;
    console.error("[ocorrencias] falha ao confirmar:", e);
    return "Não foi possível aplicar as operações.";
  });
  if (erro) return c.json({ error: erro }, 400);

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});

ocorrenciasRoutes.post("/:orgId/ocorrencias/:id/descartar", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN }, 403);

  const [alvo] = await db
    .update(ocorrencia)
    .set({ status: "descartada", revisadoPorId: eu.userId, revisadoEm: new Date() })
    .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizationId, orgId), inArray(ocorrencia.status, ["pendente"])))
    .returning({ id: ocorrencia.id });
  if (!alvo) return c.json({ error: "Ocorrência não encontrada ou já revisada." }, 404);

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});
