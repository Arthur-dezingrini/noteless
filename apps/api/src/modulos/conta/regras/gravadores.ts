import {
  juntarErros,
  nomePadraoGravador,
  normalizarCodigo,
  type AprovarGravadorInput,
  type ErroSalvo,
  type EstadoGravadorInput,
  type EstadoSalvo,
  type MudarGravadorInput,
  type RespostaEstado,
} from "@vocare/shared";
import { and, count, eq, isNull, lt } from "drizzle-orm";

import { auth } from "../../../auth";
import {
  codigoDePareamento,
  DOMINIO_CONTA_GRAVADOR,
  hashDoSegredo,
  segredoConfere,
  type CredencialGravador,
} from "../../../base/gravador-atual";
import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { organization, user } from "../../../db/schema";
import { gravador } from "../../../db/tabelas/conta";
import { alvoValido, ofertaDeFirmware } from "./firmware";

const OUTRO_SEGREDO =
  "Esta placa já foi pareada com outro segredo (a memória dela foi apagada?). O super usuário pode esquecê-la em Configurações › Gravadores para parear de novo.";

/** Placas aguardando aprovação: qualquer um pode se apresentar, então há teto e prazo. */
const MAX_AGUARDANDO = 20;
const AGUARDANDO_EXPIRA_MS = 7 * 24 * 60 * 60 * 1000;

/** "Há N segundos" (relógio da placa) vira data e hora (relógio do servidor); os erros novos entram no histórico. */
function salvar(e: EstadoGravadorInput, agora: Date, errosAntigos: ErroSalvo[]): EstadoSalvo {
  const ha = (seg: number) => new Date(agora.getTime() - seg * 1000).toISOString();
  return {
    versao: e.versao,
    wifi: e.wifi,
    fila: e.fila,
    recusadas: e.recusadas,
    cartao: e.cartao,
    ultimoErro: e.ultimoErro ? { texto: e.ultimoErro.texto, em: ha(e.ultimoErro.haSeg) } : null,
    erros: juntarErros(
      errosAntigos,
      e.erros.map((x) => ({ texto: x.texto, em: ha(x.haSeg) })),
    ),
    boot: { motivo: e.boot.motivo, em: ha(e.boot.haSeg) },
    atualizacao: e.atualizacao,
  };
}

function aguardando(codigo: string): RespostaEstado {
  return { destino: null, aviso: `Aguardando aprovação no Noteless (código ${codigo}).`, pausado: false, firmware: null };
}

/** Para onde as notas da placa vão agora — ou por que não vão para lugar nenhum — e se o envio está pausado. */
async function destinoDe(organizationId: string | null, pausado: boolean): Promise<RespostaEstado> {
  if (!organizationId) return { destino: null, aviso: "Nenhuma empresa escolhida para este gravador.", pausado, firmware: null };
  const [o] = await db.select({ id: organization.id, nome: organization.name }).from(organization).where(eq(organization.id, organizationId)).limit(1);
  if (!o) return { destino: null, aviso: "A empresa deste gravador não existe mais.", pausado, firmware: null };
  return { destino: { id: o.id, nome: o.nome }, aviso: null, pausado, firmware: null };
}

export type AvisoRecebido = { aguardando: boolean; resposta: RespostaEstado };

/**
 * Aviso de estado da placa, que é também como ela se apresenta: série nova
 * entra aguardando aprovação; aprovada, a resposta diz para onde as notas vão.
 */
export async function receberEstado(cred: CredencialGravador, e: EstadoGravadorInput, agora = new Date()): Promise<Resultado<AvisoRecebido>> {
  if (e.serie !== cred.serie) return falha(400, "A série do aviso não é a da credencial.");
  const [atual] = await db.select().from(gravador).where(eq(gravador.serie, e.serie)).limit(1);
  if (atual && !segredoConfere(cred.segredo, atual.segredoHash)) return falha(403, OUTRO_SEGREDO);
  // Estado gravado antes do histórico existir não tem `erros`.
  const estado = salvar(e, agora, (atual?.estado as Partial<EstadoSalvo> | undefined)?.erros ?? []);

  if (atual) {
    await db.update(gravador).set({ estado, vistoEm: agora }).where(eq(gravador.id, atual.id));
    if (!atual.aprovadoEm) return ok({ aguardando: true, resposta: aguardando(atual.codigo) });
    const resposta = await destinoDe(atual.organizationId, atual.envioPausado);
    return ok({ aguardando: false, resposta: { ...resposta, firmware: await ofertaDeFirmware(atual.firmwareAlvo, e.versao) } });
  }

  await db.delete(gravador).where(and(isNull(gravador.aprovadoEm), lt(gravador.vistoEm, new Date(agora.getTime() - AGUARDANDO_EXPIRA_MS))));
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(gravador).where(isNull(gravador.aprovadoEm));
  if (n >= MAX_AGUARDANDO)
    return falha(429, "Gravadores demais aguardando aprovação. Aprove ou esqueça algum em Configurações › Gravadores.");

  const codigo = codigoDePareamento(cred.segredo);
  const [novo] = await db
    .insert(gravador)
    .values({ serie: e.serie, nome: nomePadraoGravador(e.serie), segredoHash: hashDoSegredo(cred.segredo), codigo, estado, vistoEm: agora })
    .onConflictDoNothing({ target: gravador.serie })
    .returning();
  // Dois primeiros avisos ao mesmo tempo: o outro já criou.
  if (!novo) return receberEstado(cred, e, agora);
  return ok({ aguardando: true, resposta: aguardando(codigo) });
}

/**
 * A conta técnica da placa: autora das notas que ela manda. Sem senha, ninguém
 * entra com ela. Uma por série: esquecida e aprovada de novo, a placa volta a
 * usar a mesma (e as notas antigas continuam com o nome dela).
 */
async function contaTecnica(serie: string, nome: string): Promise<string> {
  const email = `${serie.toLowerCase().replace(/[^0-9a-f]/g, "")}@${DOMINIO_CONTA_GRAVADOR}`;
  const [existente] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existente) {
    await db.update(user).set({ name: nome }).where(eq(user.id, existente.id));
    return existente.id;
  }
  const ctx = await auth.$context;
  // Sem linkAccount: sem senha, não há como entrar com ela.
  const criado = await ctx.internalAdapter.createUser({ name: nome, email, emailVerified: false }, { method: "admin" });
  return criado.id;
}

/** O super usuário aprova a placa com o código que ela mostra e escolhe a empresa. */
export async function aprovarGravador(id: string, input: AprovarGravadorInput, agora = new Date()): Promise<Resultado<void>> {
  const [g] = await db
    .select({ id: gravador.id, serie: gravador.serie, nome: gravador.nome, codigo: gravador.codigo, aprovadoEm: gravador.aprovadoEm })
    .from(gravador)
    .where(eq(gravador.id, id))
    .limit(1);
  if (!g) return falha(404, "Gravador não encontrado.");
  if (g.aprovadoEm) return falha(409, "Este gravador já foi aprovado.");
  if (normalizarCodigo(input.codigo) !== normalizarCodigo(g.codigo))
    return falha(400, "Código errado. Confira na página de Wi-Fi do gravador (5 cliques no botão abrem a página).");
  const [o] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, input.organizationId)).limit(1);
  if (!o) return falha(404, "Empresa não encontrada.");

  const nome = input.nome ?? g.nome;
  const userId = await contaTecnica(g.serie, nome);
  await db.update(gravador).set({ aprovadoEm: agora, organizationId: o.id, nome, userId }).where(eq(gravador.id, id));
  return ok(undefined);
}

/** Nome, empresa de destino e pausa do envio (super usuário). */
export async function mudarGravador(id: string, input: MudarGravadorInput): Promise<Resultado<void>> {
  const [g] = await db.select({ id: gravador.id, userId: gravador.userId }).from(gravador).where(eq(gravador.id, id)).limit(1);
  if (!g) return falha(404, "Gravador não encontrado.");

  if (input.organizationId !== undefined) {
    const [o] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, input.organizationId)).limit(1);
    if (!o) return falha(404, "Empresa não encontrada.");
  }
  if (input.firmwareAlvo !== undefined && !(await alvoValido(input.firmwareAlvo))) return falha(404, "Versão de firmware não encontrada.");

  await db
    .update(gravador)
    .set({
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.organizationId !== undefined ? { organizationId: input.organizationId } : {}),
      ...(input.envioPausado !== undefined ? { envioPausado: input.envioPausado } : {}),
      ...(input.firmwareAlvo !== undefined ? { firmwareAlvo: input.firmwareAlvo } : {}),
    })
    .where(eq(gravador.id, id));
  // As notas novas saem com o nome novo.
  if (input.nome !== undefined && g.userId) await db.update(user).set({ name: input.nome }).where(eq(user.id, g.userId));
  return ok(undefined);
}

/** Tira a placa do sistema e corta o acesso dela na hora; ligada, ela volta a aparecer aguardando aprovação. */
export async function esquecerGravador(id: string): Promise<Resultado<void>> {
  const apagados = await db.delete(gravador).where(eq(gravador.id, id)).returning({ id: gravador.id });
  return apagados.length ? ok(undefined) : falha(404, "Gravador não encontrado.");
}
