import { nomePadraoGravador, type EstadoGravadorInput, type EstadoSalvo, type MudarGravadorInput, type RespostaEstado } from "@vocare/shared";
import { and, eq } from "drizzle-orm";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { member, organization, user } from "../../../db/schema";
import { gravador } from "../../../db/tabelas/conta";

const OUTRA_CONTA = "Esta placa está cadastrada para outra conta. O super usuário pode esquecê-la em Configurações › Gravadores.";

async function vinculada(userId: string, organizationId: string): Promise<boolean> {
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
    .limit(1);
  return Boolean(m);
}

/** "Há N segundos" (relógio da placa) vira data e hora (relógio do servidor). */
function salvar(e: EstadoGravadorInput, agora: Date): EstadoSalvo {
  const ha = (seg: number) => new Date(agora.getTime() - seg * 1000).toISOString();
  return {
    versao: e.versao,
    wifi: e.wifi,
    fila: e.fila,
    recusadas: e.recusadas,
    cartao: e.cartao,
    ultimoErro: e.ultimoErro ? { texto: e.ultimoErro.texto, em: ha(e.ultimoErro.haSeg) } : null,
    boot: { motivo: e.boot.motivo, em: ha(e.boot.haSeg) },
  };
}

/** Para onde as notas da placa vão agora — ou por que não vão para lugar nenhum. */
async function destinoDe(userId: string, organizationId: string | null): Promise<RespostaEstado> {
  if (!organizationId) return { destino: null, aviso: "Nenhuma empresa escolhida para este gravador." };
  const [o] = await db.select({ id: organization.id, nome: organization.name }).from(organization).where(eq(organization.id, organizationId)).limit(1);
  if (!o) return { destino: null, aviso: "A empresa deste gravador não existe mais." };
  if (!(await vinculada(userId, o.id))) return { destino: null, aviso: `A conta do gravador não está vinculada a ${o.nome}.` };
  return { destino: { id: o.id, nome: o.nome }, aviso: null };
}

/**
 * Aviso de estado da placa. No primeiro, ela aparece com a empresa que já está
 * usando (se a conta for vinculada a ela); depois, quem escolhe é o sistema.
 */
export async function receberEstado(userId: string, e: EstadoGravadorInput, agora = new Date()): Promise<Resultado<RespostaEstado>> {
  const estado = salvar(e, agora);
  const [atual] = await db.select().from(gravador).where(eq(gravador.serie, e.serie)).limit(1);
  if (atual && atual.userId !== userId) return falha(409, OUTRA_CONTA);

  if (atual) {
    await db.update(gravador).set({ estado, vistoEm: agora }).where(eq(gravador.id, atual.id));
    return ok(await destinoDe(userId, atual.organizationId));
  }

  const inicial = e.empresaAtual && (await vinculada(userId, e.empresaAtual)) ? e.empresaAtual : null;
  const [novo] = await db
    .insert(gravador)
    .values({ serie: e.serie, nome: nomePadraoGravador(e.serie), userId, organizationId: inicial, estado, vistoEm: agora })
    .onConflictDoNothing({ target: gravador.serie })
    .returning();
  // Dois primeiros avisos ao mesmo tempo: o outro já criou.
  if (!novo) return receberEstado(userId, e, agora);
  return ok(await destinoDe(userId, novo.organizationId));
}

/** Nome e empresa de destino (super usuário). A conta da placa precisa estar vinculada à empresa. */
export async function mudarGravador(id: string, input: MudarGravadorInput): Promise<Resultado<void>> {
  const [g] = await db
    .select({ id: gravador.id, userId: gravador.userId, email: user.email })
    .from(gravador)
    .innerJoin(user, eq(user.id, gravador.userId))
    .where(eq(gravador.id, id))
    .limit(1);
  if (!g) return falha(404, "Gravador não encontrado.");

  if (input.organizationId !== undefined) {
    const [o] = await db.select({ nome: organization.name }).from(organization).where(eq(organization.id, input.organizationId)).limit(1);
    if (!o) return falha(404, "Empresa não encontrada.");
    if (!(await vinculada(g.userId, input.organizationId)))
      return falha(409, `A conta do gravador (${g.email}) não está vinculada a ${o.nome}. Vincule em Configurações › Vínculos.`);
  }

  await db
    .update(gravador)
    .set({
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.organizationId !== undefined ? { organizationId: input.organizationId } : {}),
    })
    .where(eq(gravador.id, id));
  return ok(undefined);
}

/** Tira a placa do sistema; no próximo aviso ela reaparece, com a conta que estiver usando. */
export async function esquecerGravador(id: string): Promise<Resultado<void>> {
  const apagados = await db.delete(gravador).where(eq(gravador.id, id)).returning({ id: gravador.id });
  return apagados.length ? ok(undefined) : falha(404, "Gravador não encontrado.");
}
