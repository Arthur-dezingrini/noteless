import type { EstadoSalvo, Gravador } from "@vocare/shared";
import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "../../../db";
import { organization } from "../../../db/schema";
import { gravador } from "../../../db/tabelas/conta";

/**
 * Gravadores com empresa de destino e último estado; os que aguardam aprovação
 * vêm primeiro. Com `organizationId`, só os aprovados que mandam para ela.
 */
export async function listarGravadores(organizationId?: string): Promise<Gravador[]> {
  const linhas = await db
    .select({
      id: gravador.id,
      serie: gravador.serie,
      nome: gravador.nome,
      aprovadoEm: gravador.aprovadoEm,
      destinoId: organization.id,
      destinoNome: organization.name,
      envioPausado: gravador.envioPausado,
      firmwareAlvo: gravador.firmwareAlvo,
      vistoEm: gravador.vistoEm,
      estado: gravador.estado,
    })
    .from(gravador)
    .leftJoin(organization, eq(organization.id, gravador.organizationId))
    .where(organizationId ? and(eq(gravador.organizationId, organizationId), isNotNull(gravador.aprovadoEm)) : undefined)
    .orderBy(asc(gravador.nome));

  return linhas
    .map((l) => ({
      id: l.id,
      serie: l.serie,
      nome: l.nome,
      aprovado: l.aprovadoEm !== null,
      destino: l.destinoId && l.destinoNome !== null ? { id: l.destinoId, nome: l.destinoNome } : null,
      envioPausado: l.envioPausado,
      firmwareAlvo: l.firmwareAlvo,
      vistoEm: l.vistoEm.toISOString(),
      // Gravado por receberEstado no formato EstadoSalvo; os mais antigos não têm `erros` nem `atualizacao`.
      estado: {
        ...(l.estado as EstadoSalvo),
        erros: (l.estado as Partial<EstadoSalvo>).erros ?? [],
        atualizacao: (l.estado as Partial<EstadoSalvo>).atualizacao ?? null,
      },
    }))
    .sort((a, b) => Number(a.aprovado) - Number(b.aprovado));
}
