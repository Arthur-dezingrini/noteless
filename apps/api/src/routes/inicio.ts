import {
  ROTULO_TIPO_CONSULTA,
  rotuloAnimal,
  tipoConsultaSchema,
  type Aviso,
} from "@vocare/shared";
import { and, desc, eq, gte, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "../db";
import { animal } from "../db/animais";
import { consulta } from "../db/consultas";
import { vacina } from "../db/historico";
import { membroAtual } from "../membros/membro-atual";

/**
 * "Fique de olho" do Início: o que passou do prazo ou está para passar.
 * Calculado na hora, a partir do histórico — não há tabela de alertas.
 */
export const inicioRoutes = new Hono();

const TZ = "America/Sao_Paulo";
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
function somarDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** "do Thor", "da Mimosa". */
const de = (sexo: string | null) => (sexo === "femea" ? "da" : sexo === "macho" ? "do" : "de");

inicioRoutes.get("/:orgId/inicio/avisos", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const emSete = somarDias(hoje, 7);
  const amanha = somarDias(hoje, 1);

  const [vacinas, semConfirmar, semConcluir] = await Promise.all([
    db
      .select({ id: vacina.id, animalId: vacina.animalId, vacina: vacina.vacina, proxima: vacina.proximaData, numero: animal.numero, nome: animal.nome, sexo: animal.sexo })
      .from(vacina)
      .innerJoin(animal, eq(animal.id, vacina.animalId))
      .where(and(eq(vacina.organizationId, orgId), eq(animal.status, "ativo"), isNotNull(vacina.proximaData)))
      .orderBy(desc(vacina.data)),
    // Hoje ou amanhã, ainda "agendada" (ninguém confirmou).
    db
      .select({ id: consulta.id, tipo: consulta.tipo, data: consulta.data, numero: animal.numero, nome: animal.nome, sexo: animal.sexo })
      .from(consulta)
      .innerJoin(animal, eq(animal.id, consulta.animalId))
      .where(and(eq(consulta.organizationId, orgId), eq(consulta.status, "agendada"), gte(consulta.data, hoje), lte(consulta.data, amanha))),
    // Já passou e não foi concluída nem cancelada.
    db
      .select({ id: consulta.id, tipo: consulta.tipo, data: consulta.data, numero: animal.numero, nome: animal.nome, sexo: animal.sexo })
      .from(consulta)
      .innerJoin(animal, eq(animal.id, consulta.animalId))
      .where(and(eq(consulta.organizationId, orgId), inArray(consulta.status, ["agendada", "confirmada", "urgente"]), lt(consulta.data, hoje)))
      .orderBy(desc(consulta.data))
      .limit(3),
  ]);

  const vencidas: Aviso[] = [];
  const vencendo: Aviso[] = [];
  const vistas = new Set<string>();
  for (const v of vacinas) {
    // Só a aplicação mais recente de cada vacina, em cada animal, conta.
    const chave = `${v.animalId}:${v.vacina.toLowerCase()}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    const quem = `${de(v.sexo)} ${v.nome || rotuloAnimal(v)}${v.numero && v.nome ? ` (nº ${v.numero})` : ""}`;
    const link = `/animais/${v.animalId}`;
    if (v.proxima! < hoje) vencidas.push({ id: `v-${v.id}`, texto: `A ${v.vacina} ${quem} venceu em ${dm(v.proxima!)}`, tom: "danger", link });
    else if (v.proxima! <= emSete) vencendo.push({ id: `v-${v.id}`, texto: `A ${v.vacina} ${quem} vence em ${dm(v.proxima!)}`, tom: "warn", link });
  }

  const tipo = (t: string) => ROTULO_TIPO_CONSULTA[tipoConsultaSchema.catch("outro").parse(t)];
  const avisos: Aviso[] = [
    ...vencidas,
    ...semConcluir.map((x) => ({
      id: `c-${x.id}`,
      texto: `${tipo(x.tipo)} ${de(x.sexo)} ${rotuloAnimal(x)} em ${dm(x.data)} não foi marcada como concluída`,
      tom: "warn" as const,
      link: "/agenda",
    })),
    ...semConfirmar.map((x) => ({
      id: `a-${x.id}`,
      texto: `${tipo(x.tipo)} ${de(x.sexo)} ${rotuloAnimal(x)} ${x.data === hoje ? "hoje" : "amanhã"} ainda sem confirmação`,
      tom: "warn" as const,
      link: "/agenda",
    })),
    ...vencendo,
  ];

  return c.json(avisos.slice(0, 6));
});
