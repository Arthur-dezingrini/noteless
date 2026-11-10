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
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db";
import { animal } from "../db/animais";
import { consulta } from "../db/consultas";
import { grupo, grupoAnimal, parto, pesagem, tratamento, vacina } from "../db/historico";
import { anotacaoAnimal, ocorrencia, ocorrenciaAudio } from "../db/ocorrencias";
import { user } from "../db/schema";
import { analisar } from "../ia/analisar";
import { IaNaoConfigurada, transcrever } from "../ia/transcrever";
import { membroAtual } from "../membros/membro-atual";
import { administradores, notificar } from "../notificacoes/notificar";

/**
 * Registros de ocorrência: áudio entra, IA propõe, humano confirma. Qualquer
 * membro grava e confere; salvar (aplicar ao sistema) ou descartar é do
 * administrador — o membro manda para ele.
 */
export const ocorrenciasRoutes = new Hono();

const PODE_SALVAR: Papel[] = ["owner", "admin"];
const SO_ADMIN = "Só o administrador salva ou descarta notas. Use \"Mandar para o administrador\".";

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
  criadoPorCargo: criador.cargo,
  audioId: ocorrenciaAudio.ocorrenciaId,
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
    criadoPorCargo: r.criadoPorCargo,
    temAudio: r.audioId !== null,
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
    .leftJoin(ocorrenciaAudio, eq(ocorrenciaAudio.ocorrenciaId, ocorrencia.id))
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
    const analise = transcricao
      ? await analisar(transcricao, hojeISO(), await animaisDaOrg(orgId), await gruposDaOrg(orgId))
      : null;

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

    // Guarda o áudio para quem confere poder ouvir. Se falhar, a ocorrência
    // continua valendo — só fica sem o player.
    await db
      .insert(ocorrenciaAudio)
      .values({ ocorrenciaId: nova!.id, mime: audio.type || "audio/webm", dados: Buffer.from(await audio.arrayBuffer()) })
      .catch((e: unknown) => console.error("[ocorrencias] falha ao guardar áudio:", e));

    await notificar(orgId, await administradores(orgId, eu.userId), {
      texto: `${eu.nome} gravou uma nota`,
      detalhe: transcricao ? transcricao.slice(0, 80) : "Áudio não entendido",
      link: `/notas?id=${nova!.id}`,
    });

    const [pronta] = await buscar(orgId, nova!.id);
    return c.json(pronta, 201);
  } catch (e) {
    if (e instanceof IaNaoConfigurada) return c.json({ error: e.message }, 503);
    console.error("[ocorrencias] falha no pipeline de áudio:", e);
    return c.json({ error: "A IA não conseguiu processar o áudio agora. Tente de novo em instantes." }, 502);
  }
});

/** Grupos com o tamanho — a IA usa para operações em massa ("vacinei o lote"). */
function gruposDaOrg(orgId: string) {
  return db
    .select({ id: grupo.id, nome: grupo.nome, animais: count(grupoAnimal.animalId) })
    .from(grupo)
    .leftJoin(grupoAnimal, eq(grupoAnimal.grupoId, grupo.id))
    .where(eq(grupo.organizationId, orgId))
    .groupBy(grupo.id)
    .orderBy(asc(grupo.nome));
}

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
  if (!alvo) return c.json({ error: "Nota não encontrada." }, 404);
  if (alvo.status !== "pendente") return c.json({ error: "Esta nota já foi revisada." }, 409);

  try {
    const analise = await analisar(body.data.texto, hojeISO(), await animaisDaOrg(orgId), await gruposDaOrg(orgId));
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

/** Quem gravou a ocorrência — se não for quem está agindo agora. */
async function donoSeOutro(id: string, eu: string) {
  const [o] = await db.select({ dono: ocorrencia.criadoPorId }).from(ocorrencia).where(eq(ocorrencia.id, id)).limit(1);
  return o?.dono && o.dono !== eu ? o.dono : null;
}

/** O áudio original, para o player da conferência. */
ocorrenciasRoutes.get("/:orgId/ocorrencias/:id/audio", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const [a] = await db
    .select({ mime: ocorrenciaAudio.mime, dados: ocorrenciaAudio.dados })
    .from(ocorrenciaAudio)
    .innerJoin(ocorrencia, eq(ocorrencia.id, ocorrenciaAudio.ocorrenciaId))
    .where(and(eq(ocorrenciaAudio.ocorrenciaId, c.req.param("id")), eq(ocorrencia.organizationId, orgId)))
    .limit(1);
  if (!a) return c.json({ error: "Áudio não encontrado." }, 404);

  return c.body(new Uint8Array(a.dados), 200, {
    "Content-Type": a.mime,
    "Cache-Control": "private, max-age=3600",
  });
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
    .returning({ id: ocorrencia.id, resumo: ocorrencia.resumo });
  if (!alvo) return c.json({ error: "Nota não encontrada ou já revisada." }, 404);

  await notificar(orgId, await administradores(orgId, eu.userId), {
    texto: `${eu.nome} mandou uma nota para conferir`,
    detalhe: alvo.resumo || null,
    link: `/notas?id=${id}`,
  });

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** "AAAA-MM-DD" + n dias. */
function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Animais que a operação atinge: o animal, ou todos do grupo. Tudo
 * conferido contra a organização — id chutado não alcança animal alheio.
 */
async function alvos(tx: Tx, op: Operacao, orgId: string): Promise<string[] | string> {
  if (op.grupoId) {
    const [g] = await tx
      .select({ id: grupo.id })
      .from(grupo)
      .where(and(eq(grupo.id, op.grupoId), eq(grupo.organizationId, orgId)))
      .limit(1);
    if (!g) return "Grupo não encontrado nesta organização.";
    const membros = await tx
      .select({ id: grupoAnimal.animalId })
      .from(grupoAnimal)
      .innerJoin(animal, eq(animal.id, grupoAnimal.animalId))
      .where(and(eq(grupoAnimal.grupoId, g.id), eq(animal.status, "ativo")));
    if (membros.length === 0) return "O grupo não tem animais ativos.";
    return membros.map((m) => m.id);
  }
  if (!op.animalId) return "Operação sem animal do cadastro não pode ser aplicada.";
  const [a] = await tx
    .select({ id: animal.id })
    .from(animal)
    .where(and(eq(animal.id, op.animalId), eq(animal.organizationId, orgId)))
    .limit(1);
  if (!a) return "Animal não encontrado nesta organização.";
  return [a.id];
}

/** Aplica uma operação já confirmada. Devolve a mensagem de erro, ou null. */
async function aplicar(tx: Tx, op: Operacao, orgId: string, userId: string, ocorrenciaId: string) {
  const hoje = hojeISO();
  const origem = { organizationId: orgId, ocorrenciaId, criadoPorId: userId };

  if (op.tipo === "cadastrar_animal") {
    await tx.insert(animal).values({
      organizationId: orgId,
      nome: op.nome,
      especie: op.especie,
      raca: op.raca,
      sexo: op.sexo,
      nascimento: op.nascimento,
    });
    return null;
  }

  const ids = await alvos(tx, op, orgId);
  if (typeof ids === "string") return ids;
  const um = ids[0]!;

  switch (op.tipo) {
    case "agendar_consulta":
      await tx.insert(consulta).values({
        organizationId: orgId,
        // Consulta de grupo fica no grupo ("vacinar o Lote 4"), não em cada animal.
        animalId: op.grupoId ? null : um,
        grupoId: op.grupoId ?? null,
        data: op.data ?? hoje,
        hora: op.hora ?? HORA_PADRAO,
        tipo: op.tipoConsulta,
        observacoes: op.observacoes ?? op.detalhe,
      });
      return null;
    case "registrar_anotacao":
      await tx.insert(anotacaoAnimal).values(ids.map((animalId) => ({ ...origem, animalId, texto: op.texto })));
      return null;
    case "registrar_peso":
      await tx.insert(pesagem).values({ ...origem, animalId: um, pesoKg: String(op.pesoKg), data: hoje });
      // O cadastro guarda o peso atual; o histórico fica na pesagem.
      await tx.update(animal).set({ pesoKg: String(op.pesoKg) }).where(eq(animal.id, um));
      return null;
    case "aplicar_vacina":
      await tx.insert(vacina).values(
        ids.map((animalId) => ({
          ...origem,
          animalId,
          vacina: op.vacina,
          dose: op.dose,
          grupoId: op.grupoId ?? null,
          data: op.data ?? hoje,
          proximaData: op.proximaData,
        })),
      );
      return null;
    case "registrar_remedio":
      await tx.insert(tratamento).values(
        ids.map((animalId) => ({
          ...origem,
          animalId,
          remedio: op.remedio,
          dose: op.dose,
          grupoId: op.grupoId ?? null,
          inicio: hoje,
          fim: op.dias ? somarDias(hoje, op.dias - 1) : null,
          carenciaDias: op.carenciaDias,
        })),
      );
      return null;
    case "registrar_parto":
      await tx.insert(parto).values({ ...origem, animalId: um, data: op.data ?? hoje, crias: op.crias, observacoes: op.observacoes });
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
  if (!alvo) return c.json({ error: "Nota não encontrada." }, 404);
  if (alvo.status !== "pendente") return c.json({ error: "Esta nota já foi revisada." }, 409);

  // Correções de quem conferiu entram antes de aplicar; o valor da IA fica
  // em `original` de cada operação (trilha de auditoria).
  const corrigidas: Operacao[] = [];
  for (const [i, op] of alvo.operacoes.entries()) {
    const r = corrigirOperacao(op, body.data.correcoes?.[String(i)]);
    if (r.ok === false) return c.json({ error: `${r.error} (ação ${i + 1})` }, 400);
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

  const n = escolhidas.length;
  await notificar(orgId, [await donoSeOutro(id, eu.userId)], {
    texto: "Sua nota foi salva",
    detalhe: `${n} ${n === 1 ? "ação feita" : "ações feitas"} no sistema por ${eu.nome}`,
    link: `/notas?id=${id}`,
  });

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
  if (!alvo) return c.json({ error: "Nota não encontrada ou já revisada." }, 404);

  await notificar(orgId, [await donoSeOutro(id, eu.userId)], {
    texto: "Sua nota foi descartada",
    detalhe: `Por ${eu.nome}. Nada entrou no sistema.`,
    link: `/notas?id=${id}`,
  });

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});

/** "Voltar para conferir": desfaz um descarte. Nada foi aplicado, então é seguro. */
ocorrenciasRoutes.post("/:orgId/ocorrencias/:id/restaurar", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);
  if (!PODE_SALVAR.includes(eu.role)) return c.json({ error: SO_ADMIN }, 403);

  const [alvo] = await db
    .update(ocorrencia)
    .set({ status: "pendente", revisadoPorId: null, revisadoEm: null })
    .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizationId, orgId), eq(ocorrencia.status, "descartada")))
    .returning({ id: ocorrencia.id });
  if (!alvo) return c.json({ error: "Nota não encontrada ou não está descartada." }, 404);

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});
