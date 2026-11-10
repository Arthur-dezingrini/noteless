import { confirmarOcorrenciaSchema, corrigirOperacao, TIPOS_AVIARIO, type Ocorrencia, type Operacao } from "@vocare/shared";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { hojeISO } from "../../../base/datas";
import { db } from "../../../db";
import { animal } from "../../../db/tabelas/animais";
import { consulta } from "../../../db/tabelas/saude";
import { grupo, grupoAnimal, parto, pesagem, tratamento, vacina } from "../../../db/tabelas/historico";
import { anotacaoAnimal, ocorrencia } from "../../../db/tabelas/notas";
import { aplicarAviario } from "../../aviario";
import { falha, ok, type Resultado } from "../../../base/resultado";

const HORA_PADRAO = "08:00";

class AplicacaoFalhou extends Error {}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** "AAAA-MM-DD" + n dias. */
function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Animais que a operação atinge: o animal, ou todos do grupo. Tudo
 * conferido contra a organização — id chutado não alcança animal alheio.
 */
async function alvos(tx: Tx, op: Operacao, orgId: string): Promise<string[] | string> {
  if (op.grupoId) {
    const [g] = await tx
      .select({ id: grupo.id })
      .from(grupo)
      .where(and(eq(grupo.id, op.grupoId), eq(grupo.organizationId, orgId)))
      .limit(1);
    if (!g) return "Grupo não encontrado nesta organização.";
    const membros = await tx
      .select({ id: grupoAnimal.animalId })
      .from(grupoAnimal)
      .innerJoin(animal, eq(animal.id, grupoAnimal.animalId))
      .where(and(eq(grupoAnimal.grupoId, g.id), eq(animal.status, "ativo")));
    if (membros.length === 0) return "O grupo não tem animais ativos.";
    return membros.map((m) => m.id);
  }
  if (!op.animalId) return "Operação sem animal do cadastro não pode ser aplicada.";
  const [a] = await tx
    .select({ id: animal.id })
    .from(animal)
    .where(and(eq(animal.id, op.animalId), eq(animal.organizationId, orgId)))
    .limit(1);
  if (!a) return "Animal não encontrado nesta organização.";
  return [a.id];
}

/**
 * Aplica uma operação já confirmada. Devolve a mensagem de erro, ou null.
 * O que foi feito e veio sem data (peso, vacina, remédio, parto) fica no
 * `dia` em que a ocorrência foi gravada, não no dia em que alguém salvou.
 */
export async function aplicar(tx: Tx, op: Operacao, orgId: string, userId: string, ocorrenciaId: string, dia: string) {
  const origem = { organizationId: orgId, ocorrenciaId, criadoPorId: userId };

  if (op.tipo === "cadastrar_animal") {
    await tx.insert(animal).values({
      organizationId: orgId,
      nome: op.nome,
      especie: op.especie,
      raca: op.raca,
      sexo: op.sexo,
      nascimento: op.nascimento,
    });
    return null;
  }

  if (TIPOS_AVIARIO.includes(op.tipo)) return aplicarAviario(tx, op, origem, hojeISO(), dia);

  const ids = await alvos(tx, op, orgId);
  if (typeof ids === "string") return ids;
  const um = ids[0]!;

  switch (op.tipo) {
    case "agendar_consulta":
      await tx.insert(consulta).values({
        organizationId: orgId,
        // Consulta de grupo fica no grupo ("vacinar o Lote 4"), não em cada animal.
        animalId: op.grupoId ? null : um,
        grupoId: op.grupoId ?? null,
        // Agendar é para a frente: sem data, vale o dia em que salvou.
        data: op.data ?? hojeISO(),
        hora: op.hora ?? HORA_PADRAO,
        tipo: op.tipoConsulta,
        observacoes: op.observacoes ?? op.detalhe,
      });
      return null;
    case "registrar_anotacao":
      await tx.insert(anotacaoAnimal).values(ids.map((animalId) => ({ ...origem, animalId, texto: op.texto })));
      return null;
    case "registrar_peso":
      await tx.insert(pesagem).values({ ...origem, animalId: um, pesoKg: String(op.pesoKg), data: dia });
      // O cadastro guarda o peso atual; o histórico fica na pesagem.
      await tx.update(animal).set({ pesoKg: String(op.pesoKg) }).where(eq(animal.id, um));
      return null;
    case "aplicar_vacina":
      await tx.insert(vacina).values(
        ids.map((animalId) => ({
          ...origem,
          animalId,
          vacina: op.vacina,
          dose: op.dose,
          grupoId: op.grupoId ?? null,
          data: op.data ?? dia,
          proximaData: op.proximaData,
        })),
      );
      return null;
    case "registrar_remedio":
      await tx.insert(tratamento).values(
        ids.map((animalId) => ({
          ...origem,
          animalId,
          remedio: op.remedio,
          dose: op.dose,
          grupoId: op.grupoId ?? null,
          inicio: dia,
          fim: op.dias ? somarDias(dia, op.dias - 1) : null,
          carenciaDias: op.carenciaDias,
        })),
      );
      return null;
    case "registrar_parto":
      await tx.insert(parto).values({ ...origem, animalId: um, data: op.data ?? dia, crias: op.crias, observacoes: op.observacoes });
      return null;
  }
}

/**
 * Confirma a nota: aplica as correções de quem conferiu e grava as operações
 * escolhidas. Tudo ou nada: se uma falha, nenhuma é gravada e a nota continua
 * pendente para o revisor ajustar. Devolve quantas ações entraram.
 */
export async function confirmarNota(
  orgId: string,
  userId: string,
  alvo: Ocorrencia,
  dados: z.infer<typeof confirmarOcorrenciaSchema>,
): Promise<Resultado<number>> {
  const id = alvo.id;
  // Correções de quem conferiu entram antes de aplicar; o valor da IA fica
  // em `original` de cada operação (trilha de auditoria).
  const corrigidas: Operacao[] = [];
  for (const [i, op] of alvo.operacoes.entries()) {
    const r = corrigirOperacao(op, dados.correcoes?.[String(i)]);
    if (r.ok === false) return falha(400, `${r.error} (ação ${i + 1})`);
    corrigidas.push(r.op);
  }

  const indices = new Set(dados.operacoes);
  const escolhidas = corrigidas.filter((_, i) => indices.has(i));
  // Fica registrado o que foi proposto, o que foi corrigido e o que de fato entrou.
  const marcadas = corrigidas.map((op, i) => ({ ...op, aplicada: indices.has(i) }));

  // Tudo ou nada: se uma operação falha, nenhuma é gravada e a ocorrência
  // continua pendente para o revisor ajustar.
  const erro = await db.transaction(async (tx) => {
    for (const op of escolhidas) {
      const e = await aplicar(tx, op, orgId, userId, id, hojeISO(alvo.createdAt));
      // Lançar desfaz a transação; a mensagem volta para o revisor.
      if (e) throw new AplicacaoFalhou(e);
    }
    await tx
      .update(ocorrencia)
      .set({ status: "confirmada", revisadoPorId: userId, revisadoEm: new Date(), operacoes: marcadas })
      .where(and(eq(ocorrencia.id, id), eq(ocorrencia.organizationId, orgId)));
    return null;
  }).catch((e: unknown) => {
    if (e instanceof AplicacaoFalhou) return e.message;
    console.error("[ocorrencias] falha ao confirmar:", e);
    return "Não foi possível aplicar as operações.";
  });
  if (erro) return falha(400, erro);
  return ok(escolhidas.length);
}
