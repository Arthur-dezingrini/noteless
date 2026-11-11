import type { EstadoSalvo, Gravador } from "@vocare/shared";
import { and, asc, eq } from "drizzle-orm";

import { db } from "../../../db";
import { member, organization, user } from "../../../db/schema";
import { gravador } from "../../../db/tabelas/conta";

/** Gravadores com conta, empresa de destino e último estado. Com `organizationId`, só os que mandam para ela. */
export async function listarGravadores(organizationId?: string): Promise<Gravador[]> {
  const linhas = await db
    .select({
      id: gravador.id,
      serie: gravador.serie,
      nome: gravador.nome,
      contaId: user.id,
      contaNome: user.name,
      contaEmail: user.email,
      destinoId: organization.id,
      destinoNome: organization.name,
      membroId: member.id,
      vistoEm: gravador.vistoEm,
      estado: gravador.estado,
    })
    .from(gravador)
    .innerJoin(user, eq(user.id, gravador.userId))
    .leftJoin(organization, eq(organization.id, gravador.organizationId))
    .leftJoin(member, and(eq(member.userId, gravador.userId), eq(member.organizationId, gravador.organizationId)))
    .where(organizationId ? eq(gravador.organizationId, organizationId) : undefined)
    .orderBy(asc(gravador.nome));

  return linhas.map((l) => ({
    id: l.id,
    serie: l.serie,
    nome: l.nome,
    conta: { id: l.contaId, nome: l.contaNome, email: l.contaEmail },
    destino: l.destinoId && l.destinoNome !== null ? { id: l.destinoId, nome: l.destinoNome } : null,
    destinoValido: Boolean(l.destinoId && l.membroId),
    vistoEm: l.vistoEm.toISOString(),
    // Gravado por receberEstado, sempre no formato EstadoSalvo.
    estado: l.estado as EstadoSalvo,
  }));
}
