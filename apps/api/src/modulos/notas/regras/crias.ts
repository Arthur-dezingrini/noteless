import { eq } from "drizzle-orm";

import { animal } from "../../../db/tabelas/animais";
import { grupo, grupoAnimal } from "../../../db/tabelas/historico";
import type { Tx } from "./aplicar";

/**
 * Os nomes das crias no cadastro: os que foram ditos, na ordem, e as outras
 * com o nome de quem é a mãe ("Cria 2 da Pintada"), para quem cuida achar
 * e renomear depois.
 */
export function nomesDasCrias(quantas: number, nomesDitos: string | null, mae: string): string[] {
  const ditos = (nomesDitos ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const total = Math.max(quantas, ditos.length);
  if (total === 1 && !ditos.length) return [`Cria da ${mae}`];
  return Array.from({ length: total }, (_, i) => ditos[i] ?? `Cria ${i + 1} da ${mae}`);
}

/**
 * Parto salvo: cada cria vira animal no cadastro, com a espécie, a raça e o
 * local da mãe, nascida no dia do parto. Mais de uma, ficam também num
 * grupo, para "vacinei os leitões da Porca 7" ter alvo.
 */
export async function cadastrarCrias(
  tx: Tx,
  orgId: string,
  maeId: string,
  parto: { data: string; crias: number | null; nomesCrias: string | null },
) {
  const [mae] = await tx
    .select({ nome: animal.nome, numero: animal.numero, especie: animal.especie, raca: animal.raca, local: animal.local })
    .from(animal)
    .where(eq(animal.id, maeId))
    .limit(1);
  if (!mae) return;
  const deQuem = mae.nome || `nº ${mae.numero}`;
  const nomes = nomesDasCrias(parto.crias ?? 0, parto.nomesCrias, deQuem);
  if (!nomes.length) return;

  const crias = await tx
    .insert(animal)
    .values(nomes.map((nome) => ({ organizationId: orgId, nome, especie: mae.especie, raca: mae.raca, local: mae.local, nascimento: parto.data })))
    .returning({ id: animal.id });
  if (crias.length < 2) return;

  const [dia, mes] = [parto.data.slice(8, 10), parto.data.slice(5, 7)];
  const [g] = await tx
    .insert(grupo)
    .values({ organizationId: orgId, nome: `Crias da ${deQuem} · ${dia}/${mes}`, especie: mae.especie, local: mae.local })
    .returning({ id: grupo.id });
  await tx.insert(grupoAnimal).values(crias.map((c) => ({ grupoId: g!.id, animalId: c.id })));
}
