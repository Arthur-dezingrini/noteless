import { and, eq } from "drizzle-orm";

import { db } from "../../../db";
import { animal } from "../../../db/tabelas/animais";
import { consulta, prontuario } from "../../../db/tabelas/saude";
import { member } from "../../../db/schema";

/**
 * Animal, veterinário e consulta precisam ser desta organização — e a
 * consulta, do mesmo animal. Sem isso um id chutado ligaria o atendimento
 * à fazenda de outro.
 */
export async function validarVinculos(
  orgId: string,
  d: { animalId: string; veterinarioId?: string | null; consultaId?: string | null },
  ignorar?: string,
) {
  const [a] = await db
    .select({ id: animal.id })
    .from(animal)
    .where(and(eq(animal.id, d.animalId), eq(animal.organizationId, orgId)))
    .limit(1);
  if (!a) return "Animal não encontrado nesta organização.";

  if (d.veterinarioId) {
    const [m] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, d.veterinarioId), eq(member.organizationId, orgId)))
      .limit(1);
    if (!m) return "Veterinário não faz parte desta organização.";
  }

  if (d.consultaId) {
    const [cons] = await db
      .select({ animalId: consulta.animalId })
      .from(consulta)
      .where(and(eq(consulta.id, d.consultaId), eq(consulta.organizationId, orgId)))
      .limit(1);
    if (!cons) return "Consulta não encontrada.";
    if (cons.animalId !== d.animalId) return "Essa consulta é de outro animal.";
    const [ja] = await db
      .select({ id: prontuario.id })
      .from(prontuario)
      .where(eq(prontuario.consultaId, d.consultaId))
      .limit(1);
    if (ja && ja.id !== ignorar) return "Essa consulta já tem atendimento registrado.";
  }
  return null;
}
