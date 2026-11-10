import type { criarInstalacaoSchema, editarInstalacaoSchema, Instalacao } from "@vocare/shared";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { instalacao } from "../../../db/tabelas/aviario";
import { listarInstalacoes } from "../consultas/instalacoes";
import { nomeRepetido } from "./falha";

const NOME_REPETIDO = "Já existe uma instalação com esse nome.";

export async function criarInstalacao(
  orgId: string,
  userId: string,
  dados: z.infer<typeof criarInstalacaoSchema>,
): Promise<Resultado<Instalacao>> {
  try {
    const [nova] = await db
      .insert(instalacao)
      .values({
        organizationId: orgId,
        criadoPorId: userId,
        nome: dados.nome,
        tipo: dados.tipo,
        capacidade: dados.capacidade ?? null,
        areaM2: dados.areaM2 == null ? null : String(dados.areaM2),
      })
      .returning({ id: instalacao.id });
    const [criada] = await listarInstalacoes(orgId, nova!.id);
    return ok(criada!);
  } catch (e) {
    if (nomeRepetido(e)) return falha(409, NOME_REPETIDO);
    throw e;
  }
}

export async function editarInstalacao(
  orgId: string,
  id: string,
  dados: z.infer<typeof editarInstalacaoSchema>,
): Promise<Resultado<Instalacao>> {
  const { areaM2, ...resto } = dados;
  const campos = {
    ...resto,
    ...(areaM2 === undefined ? {} : { areaM2: areaM2 === null ? null : String(areaM2) }),
  };
  // Só campos enviados são gravados; `undefined` o Drizzle ignora.
  try {
    const alvo =
      Object.keys(campos).length === 0
        ? await db.select({ id: instalacao.id }).from(instalacao).where(and(eq(instalacao.id, id), eq(instalacao.organizationId, orgId)))
        : await db
            .update(instalacao)
            .set(campos)
            .where(and(eq(instalacao.id, id), eq(instalacao.organizationId, orgId)))
            .returning({ id: instalacao.id });
    if (alvo.length === 0) return falha(404, "Instalação não encontrada.");
  } catch (e) {
    if (nomeRepetido(e)) return falha(409, NOME_REPETIDO);
    throw e;
  }
  const [atualizada] = await listarInstalacoes(orgId, id);
  return ok(atualizada!);
}
