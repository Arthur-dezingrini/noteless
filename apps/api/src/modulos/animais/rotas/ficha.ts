import {
  ROTULO_STATUS_CONSULTA,
  ROTULO_TIPO_CONSULTA,
  operacaoSchema,
  statusConsultaSchema,
  tipoConsultaSchema,
  type Evento,
  type FichaAnimal,
  type Pendencia,
} from "@vocare/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../../../db";
import { animal } from "../../../db/tabelas/animais";
import { consulta, prontuario } from "../../../db/tabelas/saude";
import { grupo, grupoAnimal, parto, pesagem, tratamento, vacina } from "../../../db/tabelas/historico";
import { anotacaoAnimal, ocorrencia } from "../../../db/tabelas/notas";
import { user } from "../../../db/schema";
import { membroAtual } from "../../../base/membro-atual";
import { paraContrato } from "./animais";

/**
 * Ficha do animal: cadastro, histórico unificado (pesagens, vacinas,
 * consultas, anotações, tratamentos, partos), o que vem pela frente e o que
 * está pendente. Uma chamada só — a tela é de leitura.
 */
export const fichaRoutes = new Hono();

const TZ = "America/Sao_Paulo";
const diaSP = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const kg = (v: string | number) => `${Number(v).toLocaleString("pt-BR")} kg`;
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

fichaRoutes.get("/:orgId/animais/:id/ficha", async (c) => {
  const orgId = c.req.param("orgId");
  const id = c.req.param("id");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const [a] = await db
    .select()
    .from(animal)
    .where(and(eq(animal.id, id), eq(animal.organizationId, orgId)))
    .limit(1);
  if (!a) return c.json({ error: "Animal não encontrado." }, 404);

  const [grupos, pesagens, vacinas, consultas, anotacoes, tratamentos, partos, pendentes, prontuarios] = await Promise.all([
    db
      .select({ id: grupo.id, nome: grupo.nome })
      .from(grupoAnimal)
      .innerJoin(grupo, eq(grupo.id, grupoAnimal.grupoId))
      .where(eq(grupoAnimal.animalId, id)),
    db
      .select({ id: pesagem.id, data: pesagem.data, pesoKg: pesagem.pesoKg, por: user.name, oc: pesagem.ocorrenciaId, em: pesagem.createdAt })
      .from(pesagem)
      .leftJoin(user, eq(user.id, pesagem.criadoPorId))
      .where(eq(pesagem.animalId, id))
      .orderBy(desc(pesagem.data), desc(pesagem.createdAt)),
    db
      .select({ id: vacina.id, data: vacina.data, vacina: vacina.vacina, dose: vacina.dose, proxima: vacina.proximaData, por: user.name, oc: vacina.ocorrenciaId, em: vacina.createdAt })
      .from(vacina)
      .leftJoin(user, eq(user.id, vacina.criadoPorId))
      .where(eq(vacina.animalId, id))
      .orderBy(desc(vacina.data)),
    db
      .select({ id: consulta.id, data: consulta.data, hora: consulta.hora, tipo: consulta.tipo, status: consulta.status, obs: consulta.observacoes, por: user.name })
      .from(consulta)
      .leftJoin(user, eq(user.id, consulta.veterinarioId))
      .where(eq(consulta.animalId, id))
      .orderBy(desc(consulta.data)),
    db
      .select({ id: anotacaoAnimal.id, em: anotacaoAnimal.createdAt, texto: anotacaoAnimal.texto, por: user.name, oc: anotacaoAnimal.ocorrenciaId })
      .from(anotacaoAnimal)
      .leftJoin(user, eq(user.id, anotacaoAnimal.criadoPorId))
      .where(eq(anotacaoAnimal.animalId, id))
      .orderBy(desc(anotacaoAnimal.createdAt)),
    db
      .select({ id: tratamento.id, inicio: tratamento.inicio, fim: tratamento.fim, remedio: tratamento.remedio, dose: tratamento.dose, carencia: tratamento.carenciaDias, por: user.name, oc: tratamento.ocorrenciaId, em: tratamento.createdAt })
      .from(tratamento)
      .leftJoin(user, eq(user.id, tratamento.criadoPorId))
      .where(eq(tratamento.animalId, id))
      .orderBy(desc(tratamento.inicio)),
    db
      .select({ id: parto.id, data: parto.data, crias: parto.crias, obs: parto.observacoes, por: user.name, oc: parto.ocorrenciaId, em: parto.createdAt })
      .from(parto)
      .leftJoin(user, eq(user.id, parto.criadoPorId))
      .where(eq(parto.animalId, id))
      .orderBy(desc(parto.data)),
    db
      .select({ id: ocorrencia.id, operacoes: ocorrencia.operacoes, transcricao: ocorrencia.transcricao })
      .from(ocorrencia)
      .where(and(eq(ocorrencia.organizationId, orgId), eq(ocorrencia.status, "pendente"))),
    db
      .select({ id: prontuario.id, consultaId: prontuario.consultaId, data: prontuario.data, tipo: prontuario.tipo, diagnostico: prontuario.diagnostico, queixa: prontuario.queixa, por: user.name })
      .from(prontuario)
      .leftJoin(user, eq(user.id, prontuario.veterinarioId))
      .where(eq(prontuario.animalId, id)),
  ]);

  const hoje = diaSP(new Date());
  const limiteNovo = Date.now() - 48 * 3600 * 1000;
  /** Salvo de um áudio há pouco: a ficha destaca como "Novo". */
  const novo = (oc: string | null, em: Date) => !!oc && em.getTime() > limiteNovo;
  const historico: Evento[] = [];
  const proximos: Evento[] = [];
  const pendencias: Pendencia[] = [];

  pesagens.forEach((p, i) => {
    const anterior = pesagens[i + 1];
    const dif = anterior ? Number(p.pesoKg) - Number(anterior.pesoKg) : null;
    historico.push({
      id: p.id,
      tipo: "pesagem",
      data: p.data,
      titulo: `Pesagem: ${kg(p.pesoKg)}`,
      detalhe: dif === null || dif === 0 ? null : `${dif > 0 ? "+" : "−"}${kg(Math.abs(dif))} desde ${dm(anterior!.data)}`,
      por: p.por,
      ocorrenciaId: p.oc,
      novo: novo(p.oc, p.em),
    });
  });

  const vacinaMaisRecente = new Map<string, string>(); // nome → última data
  for (const v of vacinas) {
    historico.push({ id: v.id, tipo: "vacina", data: v.data, titulo: `Vacina ${v.vacina}`, detalhe: v.dose, por: v.por, ocorrenciaId: v.oc, novo: novo(v.oc, v.em) });
    const chave = v.vacina.toLowerCase();
    if (!vacinaMaisRecente.has(chave)) {
      vacinaMaisRecente.set(chave, v.data);
      // Só a aplicação mais recente de cada vacina decide se está em dia.
      if (v.proxima && v.proxima >= hoje) {
        proximos.push({ id: `prox-${v.id}`, tipo: "vacina", data: v.proxima, titulo: `Reforço: ${v.vacina}`, detalhe: v.dose ? `última: ${v.dose}` : null });
      } else if (v.proxima) {
        pendencias.push({ id: `venc-${v.id}`, texto: `A vacina ${v.vacina} venceu em ${v.proxima.slice(8, 10)}/${v.proxima.slice(5, 7)}/${v.proxima.slice(0, 4)}.` });
      }
    }
  }

  // Consulta com atendimento registrado mostra o diagnóstico e leva ao prontuário.
  const atendimentoDa = new Map(prontuarios.filter((p) => p.consultaId).map((p) => [p.consultaId!, p]));
  for (const cons of consultas) {
    const at = atendimentoDa.get(cons.id);
    const tipo = ROTULO_TIPO_CONSULTA[tipoConsultaSchema.catch("outro").parse(cons.tipo)];
    const status = statusConsultaSchema.catch("agendada").parse(cons.status);
    const futura = cons.data > hoje || (cons.data === hoje && status !== "concluida");
    const ev: Evento = {
      id: cons.id,
      tipo: "consulta",
      data: cons.data,
      titulo: `${tipo} às ${cons.hora}`,
      detalhe: at
        ? at.diagnostico || at.queixa || null
        : [ROTULO_STATUS_CONSULTA[status], cons.obs].filter(Boolean).join(" · "),
      por: at?.por ?? cons.por,
      prontuarioId: at?.id,
    };
    if (status === "cancelada") historico.push(ev);
    else if (futura) proximos.push(ev);
    else historico.push(ev);
  }

  // Atendimento que não veio de consulta agendada (emergência, visita avulsa).
  for (const p of prontuarios) {
    if (p.consultaId) continue;
    historico.push({
      id: p.id,
      tipo: "consulta",
      data: p.data,
      titulo: ROTULO_TIPO_CONSULTA[tipoConsultaSchema.catch("outro").parse(p.tipo)],
      detalhe: p.diagnostico || p.queixa || null,
      por: p.por,
      prontuarioId: p.id,
    });
  }

  for (const n of anotacoes) {
    historico.push({ id: n.id, tipo: "anotacao", data: diaSP(n.em), titulo: "Anotação", detalhe: n.texto, por: n.por, ocorrenciaId: n.oc, novo: novo(n.oc, n.em) });
  }

  for (const t of tratamentos) {
    const detalhe = [t.dose, t.fim ? `até ${dm(t.fim)}` : null, t.carencia ? `carência de ${t.carencia} dias` : null]
      .filter(Boolean)
      .join(" · ");
    historico.push({ id: t.id, tipo: "tratamento", data: t.inicio, titulo: `Remédio: ${t.remedio}`, detalhe: detalhe || null, por: t.por, ocorrenciaId: t.oc, novo: novo(t.oc, t.em) });
    if (t.fim && t.fim >= hoje) {
      proximos.push({ id: `trat-${t.id}`, tipo: "tratamento", data: t.fim, titulo: `Fim do tratamento: ${t.remedio}`, detalhe: t.dose });
    }
  }

  for (const p of partos) {
    const crias = p.crias == null ? null : `${p.crias} ${p.crias === 1 ? "cria" : "crias"}`;
    historico.push({ id: p.id, tipo: "parto", data: p.data, titulo: "Parto", detalhe: [crias, p.obs].filter(Boolean).join(" · ") || null, por: p.por, ocorrenciaId: p.oc, novo: novo(p.oc, p.em) });
  }

  // Ocorrências para conferir que falam deste animal (ou de um grupo dele).
  const meusGrupos = new Set(grupos.map((g) => g.id));
  let ocorrenciasPendentes = 0;
  for (const oc of pendentes) {
    const ops = z.array(z.unknown()).catch([]).parse(oc.operacoes).flatMap((o) => {
      const r = operacaoSchema.safeParse(o);
      return r.success ? [r.data] : [];
    });
    const n = ops.filter((op) => op.animalId === id || (op.grupoId && meusGrupos.has(op.grupoId))).length;
    if (n > 0) ocorrenciasPendentes += 1;
  }

  historico.sort((x, y) => (x.data < y.data ? 1 : x.data > y.data ? -1 : 0));
  proximos.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0));

  const emTratamento = tratamentos.some((t) => !t.fim || t.fim >= hoje);
  const ficha: FichaAnimal = {
    animal: paraContrato(a, emTratamento),
    grupos,
    historico,
    proximos,
    pendencias,
    ocorrenciasPendentes,
  };
  return c.json(ficha);
});
