import { operacaoSchema, statusOcorrenciaSchema, type Ocorrencia } from "@vocare/shared";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db } from "../../db";
import { animal } from "../../db/tabelas/animais";
import { grupo, grupoAnimal } from "../../db/tabelas/historico";
import { ocorrencia, ocorrenciaAudio } from "../../db/tabelas/notas";
import { user } from "../../db/schema";

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
export function paraContrato(r: Linha): Ocorrencia {
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

export async function buscar(orgId: string, id?: string) {
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

/** Grupos com o tamanho — a IA usa para operações em massa ("vacinei o lote"). */
export function gruposDaOrg(orgId: string) {
  return db
    .select({ id: grupo.id, nome: grupo.nome, animais: count(grupoAnimal.animalId) })
    .from(grupo)
    .leftJoin(grupoAnimal, eq(grupoAnimal.grupoId, grupo.id))
    .where(eq(grupo.organizationId, orgId))
    .groupBy(grupo.id)
    .orderBy(asc(grupo.nome));
}

/** Animais ativos da organização — o contexto que a IA usa para ligar nomes a ids. */
export function animaisDaOrg(orgId: string) {
  return db
    .select({ id: animal.id, nome: animal.nome, especie: animal.especie, raca: animal.raca, tutor: animal.tutor })
    .from(animal)
    .where(and(eq(animal.organizationId, orgId), eq(animal.status, "ativo")))
    .orderBy(asc(animal.nome));
}

/** Quem gravou a ocorrência — se não for quem está agindo agora. */
export async function donoSeOutro(id: string, eu: string) {
  const [o] = await db.select({ dono: ocorrencia.criadoPorId }).from(ocorrencia).where(eq(ocorrencia.id, id)).limit(1);
  return o?.dono && o.dono !== eu ? o.dono : null;
}
