import { especieSchema, examePedidoSchema, medidaSchema, remedioReceitadoSchema, sexoSchema, tipoConsultaSchema, type Prontuario } from "@vocare/shared";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db } from "../../../db";
import { animal } from "../../../db/tabelas/animais";
import { consulta, prontuario } from "../../../db/tabelas/saude";
import { user } from "../../../db/schema";

export const retorno = alias(consulta, "retorno");

export const colunas = {
  id: prontuario.id,
  animalId: prontuario.animalId,
  animalNome: animal.nome,
  animalNumero: animal.numero,
  animalEspecie: animal.especie,
  animalRaca: animal.raca,
  animalSexo: animal.sexo,
  animalNascimento: animal.nascimento,
  consultaId: prontuario.consultaId,
  veterinarioId: prontuario.veterinarioId,
  veterinarioNome: user.name,
  data: prontuario.data,
  tipo: prontuario.tipo,
  queixa: prontuario.queixa,
  exame: prontuario.exame,
  diagnostico: prontuario.diagnostico,
  remedios: prontuario.remedios,
  exames: prontuario.exames,
  retornoId: retorno.id,
  retornoData: retorno.data,
  retornoHora: retorno.hora,
  createdAt: prontuario.createdAt,
};

export type Linha = { [K in keyof typeof colunas]: (typeof colunas)[K]["_"]["data"] | null };

/** JSON do banco → lista validada; item estragado some em vez de derrubar a tela. */
export function lista<T extends z.ZodType>(schema: T, v: unknown): z.infer<T>[] {
  return z
    .array(z.unknown())
    .catch([])
    .parse(v)
    .flatMap((x) => {
      const r = schema.safeParse(x);
      return r.success ? [r.data] : [];
    });
}

export function paraContrato(r: Linha): Prontuario {
  return {
    id: r.id!,
    animalId: r.animalId!,
    animalNome: r.animalNome ?? "",
    animalNumero: r.animalNumero,
    animalEspecie: especieSchema.catch("outro").parse(r.animalEspecie),
    animalRaca: r.animalRaca,
    animalSexo: sexoSchema.nullish().catch(null).parse(r.animalSexo),
    animalNascimento: r.animalNascimento,
    consultaId: r.consultaId,
    veterinarioId: r.veterinarioId,
    veterinarioNome: r.veterinarioNome,
    data: r.data!,
    tipo: tipoConsultaSchema.catch("outro").parse(r.tipo),
    queixa: r.queixa ?? "",
    exame: lista(medidaSchema, r.exame),
    diagnostico: r.diagnostico ?? "",
    remedios: lista(remedioReceitadoSchema, r.remedios),
    exames: lista(examePedidoSchema, r.exames),
    retorno: r.retornoId ? { id: r.retornoId, data: r.retornoData!, hora: r.retornoHora! } : null,
    createdAt: r.createdAt!,
  };
}

export function consultar() {
  return db
    .select(colunas)
    .from(prontuario)
    .innerJoin(animal, eq(animal.id, prontuario.animalId))
    .leftJoin(user, eq(user.id, prontuario.veterinarioId))
    .leftJoin(retorno, eq(retorno.id, prontuario.retornoId));
}
