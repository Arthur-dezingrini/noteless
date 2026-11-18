import { confirmarOcorrenciaSchema, textoOcorrenciaSchema, type Papel } from "@vocare/shared";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import { alertar, mensagemDe } from "../../base/alerta";
import { hojeISO } from "../../base/datas";
import { db } from "../../db";
import { ocorrencia, ocorrenciaAudio } from "../../db/tabelas/notas";
import { analisar } from "./ia/analisar";
import { IaNaoConfigurada, transcrever } from "./ia/transcrever";
import { vocabulario } from "./ia/vocabulario";
import { gravadorNaEmpresa } from "../../base/gravador-atual";
import { membroAtual } from "../../base/membro-atual";
import { galpoesDaOrg } from "../aviario";
import { administradores, notificar } from "../avisos";
import { buscar, animaisDaOrg, donoSeOutro, gruposDaOrg } from "./consultas";
import { confirmarNota } from "./regras/aplicar";
import { quandoFoiGravado, tipoDeAudio } from "./regras/gravacao";
import { wavMuLawParaPcm16 } from "./regras/wav";

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
 * como pendente. Devolve a ocorrência pronta para a tela mostrar. Além de
 * quem está logado, o gravador de campo aprovado para a empresa manda aqui,
 * com a série e o segredo dele (base/gravador-atual.ts).
 */
notasRotas.post("/:orgId/ocorrencias", async (c) => {
  const orgId = c.req.param("orgId");
  const eu = (await gravadorNaEmpresa(c.req.raw.headers, orgId)) ?? (await membroAtual(c.req.raw.headers, orgId));
  if (!eu) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const body = await c.req.parseBody().catch(() => null);
  const recebido = body?.audio;
  if (!(recebido instanceof File) || recebido.size === 0) return c.json({ error: "Envie um áudio no campo 'audio'." }, 400);
  if (recebido.size > TAMANHO_MAXIMO) return c.json({ error: "Áudio grande demais (máximo 25 MB)." }, 413);
  const mime = tipoDeAudio(recebido.type);
  if (!mime) return c.json({ error: "Envie um arquivo de áudio (WAV, WebM, MP3…)." }, 415);
  // O gravador manda μ-law (metade do tamanho: sobe em Wi-Fi fraco); daqui em
  // diante — transcrição e player da nota — é PCM de 16 bits, como sempre foi.
  const pcm = wavMuLawParaPcm16(new Uint8Array(await recebido.arrayBuffer()));
  const audio = pcm ? new File([pcm], recebido.name, { type: "audio/wav" }) : recebido;
  const duracaoSeg = Number(body?.duracaoSeg) || null;
  // Vira a data da ocorrência e o "hoje" da IA: "nasceu hoje", gravado sem
  // sinal e enviado no dia seguinte, é do dia da gravação.
  const gravadoEm = quandoFoiGravado(body?.gravadoEm);

  try {
    const dia = hojeISO(gravadoEm ?? undefined);
    // O cadastro serve às duas etapas: a transcrição aprende a escrever os
    // nomes dele, e a interpretação liga o que foi dito aos ids.
    const [animais, grupos, galpoes] = await Promise.all([animaisDaOrg(orgId), gruposDaOrg(orgId), galpoesDaOrg(orgId, dia)]);
    const transcricao = await transcrever(audio, vocabulario(animais, grupos, galpoes));
    // Áudio que não deu para entender vira ocorrência mesmo assim: quem
    // confere escreve o que foi dito (POST /:id/texto).
    const analise = transcricao ? await analisar(transcricao, dia, animais, grupos, galpoes) : null;
    // A IA corrige palavra mal ouvida ("parca" → "porca"); o que o Whisper
    // ouviu fica guardado ao lado.
    const texto = analise?.transcricao ?? transcricao;

    const [nova] = await db
      .insert(ocorrencia)
      .values({
        organizationId: orgId,
        criadoPorId: eu.userId,
        transcricao: texto,
        transcricaoOriginal: analise?.transcricao ? transcricao : null,
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
      .values({ ocorrenciaId: nova!.id, mime, dados: Buffer.from(await audio.arrayBuffer()) })
      .catch(async (e: unknown) => {
        console.error("[ocorrencias] falha ao guardar áudio:", e);
        await alertar("guardar-audio", { mensagem: mensagemDe(e), rota: `${c.req.method} ${c.req.path}`, orgId });
      });

    await notificar(orgId, await administradores(orgId, eu.userId), {
      texto: `${eu.nome} gravou uma nota`,
      detalhe: texto ? texto.slice(0, 80) : "Áudio não entendido",
      link: `/notas?id=${nova!.id}`,
    });

    const [pronta] = await buscar(orgId, nova!.id);
    return c.json(pronta, 201);
  } catch (e) {
    if (e instanceof IaNaoConfigurada) return c.json({ error: e.message }, 503);
    console.error("[ocorrencias] falha no pipeline de áudio:", e);
    await alertar("pipeline-audio", { mensagem: mensagemDe(e), rota: `${c.req.method} ${c.req.path}`, orgId });
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
      // Texto escrito por quem confere vale como está: a correção da IA é só para o áudio.
      .set({ transcricao: body.data.texto, transcricaoOriginal: null, resumo: analise.resumo, operacoes: analise.operacoes })
      .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizationId, orgId)));
  } catch (e) {
    if (e instanceof IaNaoConfigurada) return c.json({ error: e.message }, 503);
    console.error("[ocorrencias] falha ao interpretar texto:", e);
    await alertar("interpretar-texto", { mensagem: mensagemDe(e), rota: `${c.req.method} ${c.req.path}`, orgId });
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

  // O tipo veio de quem enviou: só sai o que é áudio, e o navegador não
  // adivinha outro nem roda nada que estiver dentro do arquivo.
  return c.body(new Uint8Array(a.dados), 200, {
    "Content-Type": tipoDeAudio(a.mime) ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
    "Content-Disposition": "inline",
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
