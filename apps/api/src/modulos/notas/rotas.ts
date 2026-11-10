import { confirmarOcorrenciaSchema, textoOcorrenciaSchema, type Papel } from "@vocare/shared";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import { hojeISO } from "../../base/datas";
import { db } from "../../db";
import { ocorrencia, ocorrenciaAudio } from "../../db/tabelas/notas";
import { analisar } from "./ia/analisar";
import { IaNaoConfigurada, transcrever } from "./ia/transcrever";
import { membroAtual } from "../../base/membro-atual";
import { galpoesDaOrg } from "../aviario";
import { administradores, notificar } from "../../notificacoes/notificar";
import { buscar, animaisDaOrg, donoSeOutro, gruposDaOrg } from "./consultas";
import { confirmarNota } from "./regras/aplicar";
import { quandoFoiGravado } from "./regras/gravacao";

/**
 * Registros de ocorrência: áudio entra, IA propõe, humano confirma. Qualquer
 * membro grava e confere; salvar (aplicar ao sistema) ou descartar é do
 * administrador — o membro manda para ele.
 */
export const notasRotas = new Hono();

const PODE_SALVAR: Papel[] = ["owner", "admin"];
const SO_ADMIN = "Só o administrador salva ou descarta notas. Use \"Mandar para o administrador\".";

const TAMANHO_MAXIMO = 25 * 1024 * 1024; // limite do Whisper

notasRotas.get("/:orgId/ocorrencias", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  return c.json(await buscar(orgId));
});

/**
 * Recebe o áudio (multipart, campo `audio`), transcreve, interpreta e guarda
 * como pendente. Devolve a ocorrência pronta para a tela mostrar.
 */
notasRotas.post("/:orgId/ocorrencias", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = await membroAtual(c.req.raw.headers, orgId);
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = await c.req.parseBody().catch(() => null);
  const audio = body?.audio;
  if (!(audio instanceof File) || audio.size === 0) return c.json({ error: "Envie um áudio no campo 'audio'." }, 400);
  if (audio.size > TAMANHO_MAXIMO) return c.json({ error: "Áudio grande demais (máximo 25 MB)." }, 413);
  const duracaoSeg = Number(body?.duracaoSeg) || null;
  // Vira a data da ocorrência e o "hoje" da IA: "nasceu hoje", gravado sem
  // sinal e enviado no dia seguinte, é do dia da gravação.
  const gravadoEm = quandoFoiGravado(body?.gravadoEm);

  try {
    const transcricao = await transcrever(audio);
    // Áudio que não deu para entender vira ocorrência mesmo assim: quem
    // confere escreve o que foi dito (POST /:id/texto).
    const analise = transcricao
      ? await analisar(transcricao, hojeISO(gravadoEm ?? undefined), await animaisDaOrg(orgId), await gruposDaOrg(orgId), await galpoesDaOrg(orgId, hojeISO(gravadoEm ?? undefined)))
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
        ...(gravadoEm && { createdAt: gravadoEm }),
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

/**
 * Áudio não entendido (ou mal entendido): o texto escrito substitui a
 * transcrição e a IA interpreta de novo. Só enquanto está para conferir.
 */
notasRotas.post("/:orgId/ocorrencias/:id/texto", async (c) => {
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
    // Datas relativas do texto contam a partir do dia em que foi gravado.
    const analise = await analisar(body.data.texto, hojeISO(alvo.createdAt), await animaisDaOrg(orgId), await gruposDaOrg(orgId), await galpoesDaOrg(orgId, hojeISO(alvo.createdAt)));
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

/** O áudio original, para o player da conferência. */
notasRotas.get("/:orgId/ocorrencias/:id/audio", async (c) => {
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
notasRotas.post("/:orgId/ocorrencias/:id/encaminhar", async (c) => {
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

notasRotas.post("/:orgId/ocorrencias/:id/confirmar", async (c) => {
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

  const r = await confirmarNota(orgId, eu.userId, alvo, body.data);
  if (!r.ok) return c.json({ error: r.erro }, r.status);

  const n = r.valor;
  await notificar(orgId, [await donoSeOutro(id, eu.userId)], {
    texto: "Sua nota foi salva",
    detalhe: `${n} ${n === 1 ? "ação feita" : "ações feitas"} no sistema por ${eu.nome}`,
    link: `/notas?id=${id}`,
  });

  const [pronta] = await buscar(orgId, id);
  return c.json(pronta);
});

notasRotas.post("/:orgId/ocorrencias/:id/descartar", async (c) => {
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
notasRotas.post("/:orgId/ocorrencias/:id/restaurar", async (c) => {
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
