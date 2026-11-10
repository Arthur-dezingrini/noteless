import {
  ROTULO_PERIODO,
  ROTULO_TIPO_CONSULTA,
  PERIODOS,
  rotuloAnimal,
  tipoConsultaSchema,
  tipoRelatorioSchema,
  type Periodo,
  type Relatorio,
} from "@vocare/shared";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";

import { db } from "../db";
import { animal } from "../db/tabelas/animais";
import { consulta } from "../db/tabelas/saude";
import { grupo, pesagem, tratamento, vacina } from "../db/tabelas/historico";
import { ocorrencia } from "../db/tabelas/notas";
import { user } from "../db/schema";
import { membroAtual } from "../base/membro-atual";

/** Os cinco relatórios da tela Relatórios. Tudo calculado na hora. */
export const relatoriosRoutes = new Hono();

const TZ = "America/Sao_Paulo";
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function somarDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** [início, fim] do período, em "AAAA-MM-DD". */
function intervalo(p: Periodo, hoje: string): [string, string] {
  const [a, m] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
  const inicioMes = (ano: number, mes: number) => {
    const d = new Date(Date.UTC(ano, mes - 1, 1));
    return d.toISOString().slice(0, 10);
  };
  switch (p) {
    case "mes":
      return [inicioMes(a, m), hoje];
    case "mes-passado":
      return [inicioMes(a, m - 1), somarDias(inicioMes(a, m), -1)];
    case "3-meses":
      return [inicioMes(a, m - 2), hoje];
    case "ano":
      return [`${a}-01-01`, hoje];
  }
}

relatoriosRoutes.get("/:orgId/relatorios/:tipo", async (c) => {
  const orgId = c.req.param("orgId");
  if (!(await membroAtual(c.req.raw.headers, orgId))) return c.json({ error: "Sem acesso a esta organização." }, 403);

  const tipo = tipoRelatorioSchema.safeParse(c.req.param("tipo"));
  if (!tipo.success) return c.json({ error: "Relatório desconhecido." }, 404);
  const periodo = (PERIODOS as readonly string[]).includes(c.req.query("periodo") ?? "") ? (c.req.query("periodo") as Periodo) : "mes";
  const hoje = hojeISO();
  const [de, ate] = intervalo(periodo, hoje);
  const nomePeriodo = ROTULO_PERIODO[periodo].toLowerCase();

  let rel: Relatorio;
  switch (tipo.data) {
    case "vacinas": {
      const rows = await db
        .select({
          data: vacina.data,
          vacina: vacina.vacina,
          dose: vacina.dose,
          grupoId: vacina.grupoId,
          grupoNome: grupo.nome,
          animalId: vacina.animalId,
          numero: animal.numero,
          nome: animal.nome,
          oc: vacina.ocorrenciaId,
          por: user.name,
        })
        .from(vacina)
        .innerJoin(animal, eq(animal.id, vacina.animalId))
        .leftJoin(grupo, eq(grupo.id, vacina.grupoId))
        .leftJoin(user, eq(user.id, vacina.criadoPorId))
        .where(and(eq(vacina.organizationId, orgId), gte(vacina.data, de), lte(vacina.data, ate)))
        .orderBy(desc(vacina.data));
      // Aplicação no grupo vira uma linha só: "Lote 4 (17 animais)".
      const linhas = new Map<string, Extract<Relatorio, { tipo: "vacinas" }>["linhas"][number]>();
      for (const r of rows) {
        const chave = r.grupoId ? `g|${r.grupoId}|${r.vacina}|${r.data}` : `a|${r.animalId}|${r.vacina}|${r.data}`;
        const atual = linhas.get(chave);
        if (atual) {
          atual.doses += 1;
          continue;
        }
        linhas.set(chave, {
          data: r.data,
          alvo: r.grupoId ? (r.grupoNome ?? "Grupo") : rotuloAnimal(r),
          animalId: r.grupoId ? null : r.animalId,
          vacina: r.dose ? `${r.vacina} (${r.dose})` : r.vacina,
          por: r.por,
          porAudio: !!r.oc,
          doses: 1,
        });
      }
      const lista = [...linhas.values()].map((l) => (l.animalId ? l : { ...l, alvo: `${l.alvo} (${l.doses} ${l.doses === 1 ? "animal" : "animais"})` }));
      const doses = rows.length;
      rel = {
        tipo: "vacinas",
        resumo: doses ? `${doses} ${doses === 1 ? "dose" : "doses"} em ${lista.length} ${lista.length === 1 ? "aplicação" : "aplicações"} · ${nomePeriodo}` : `Nenhuma vacina aplicada · ${nomePeriodo}`,
        linhas: lista,
      };
      break;
    }

    case "vencer": {
      const limite = somarDias(hoje, 30);
      const rows = await db
        .select({ animalId: vacina.animalId, vacina: vacina.vacina, proxima: vacina.proximaData, numero: animal.numero, nome: animal.nome })
        .from(vacina)
        .innerJoin(animal, eq(animal.id, vacina.animalId))
        .where(and(eq(vacina.organizationId, orgId), eq(animal.status, "ativo"), isNotNull(vacina.proximaData)))
        .orderBy(desc(vacina.data));
      const vistas = new Set<string>();
      const linhas: Extract<Relatorio, { tipo: "vencer" }>["linhas"] = [];
      for (const r of rows) {
        // Só a aplicação mais recente de cada vacina, em cada animal.
        const chave = `${r.animalId}|${r.vacina.toLowerCase()}`;
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        if (r.proxima! > limite) continue;
        linhas.push({ animalId: r.animalId, alvo: rotuloAnimal(r), vacina: r.vacina, vence: r.proxima!, dias: diasEntre(hoje, r.proxima!) });
      }
      linhas.sort((a, b) => a.dias - b.dias);
      const atrasadas = linhas.filter((l) => l.dias < 0).length;
      const proximas = linhas.length - atrasadas;
      rel = {
        tipo: "vencer",
        resumo: linhas.length
          ? `${atrasadas} ${atrasadas === 1 ? "atrasada" : "atrasadas"} e ${proximas} nos próximos 30 dias.`
          : "Nenhuma vacina vencida ou vencendo nos próximos 30 dias.",
        linhas,
      };
      break;
    }

    case "peso": {
      const comPeso = await db
        .select({ id: animal.id, numero: animal.numero, nome: animal.nome, n: count(pesagem.id) })
        .from(animal)
        .innerJoin(pesagem, eq(pesagem.animalId, animal.id))
        .where(eq(animal.organizationId, orgId))
        .groupBy(animal.id)
        .orderBy(asc(animal.numero), asc(animal.nome));
      const animais = comPeso.map((a) => ({ id: a.id, rotulo: rotuloAnimal(a) }));
      const pedido = c.req.query("animalId");
      const escolhido = comPeso.find((a) => a.id === pedido) ?? comPeso[0];
      let linhas: Extract<Relatorio, { tipo: "peso" }>["linhas"] = [];
      let resumo = "Nenhuma pesagem registrada ainda.";
      if (escolhido) {
        const desde = somarDias(hoje, -186);
        const rows = await db
          .select({ data: pesagem.data, peso: pesagem.pesoKg })
          .from(pesagem)
          .where(and(eq(pesagem.animalId, escolhido.id), gte(pesagem.data, desde)))
          .orderBy(asc(pesagem.data), asc(pesagem.createdAt));
        // Um valor por mês: a última pesagem do mês.
        const porMes = new Map<string, number>();
        for (const r of rows) porMes.set(r.data.slice(0, 7), Number(r.peso));
        linhas = [...porMes.entries()].map(([mes, pesoKg]) => ({ mes, rotulo: MESES[Number(mes.slice(5, 7)) - 1]!, pesoKg }));
        const nome = escolhido.nome || rotuloAnimal(escolhido);
        if (linhas.length >= 2) {
          const [p, u] = [linhas[0]!.pesoKg, linhas.at(-1)!.pesoKg];
          const dif = u - p;
          resumo = `${nome}: de ${p.toLocaleString("pt-BR")} kg para ${u.toLocaleString("pt-BR")} kg em ${linhas.length} meses (${dif >= 0 ? "+" : "−"}${Math.abs(dif).toLocaleString("pt-BR")} kg).`;
        } else if (linhas.length === 1) {
          resumo = `${nome}: ${linhas[0]!.pesoKg.toLocaleString("pt-BR")} kg. Com mais pesagens, aparece a evolução.`;
        } else {
          resumo = `${nome}: nenhuma pesagem nos últimos 6 meses.`;
        }
      }
      rel = { tipo: "peso", resumo, animalId: escolhido?.id ?? null, animais, linhas };
      break;
    }

    case "tratamento": {
      const rows = await db
        .select({ animalId: tratamento.animalId, remedio: tratamento.remedio, dose: tratamento.dose, inicio: tratamento.inicio, fim: tratamento.fim, numero: animal.numero, nome: animal.nome })
        .from(tratamento)
        .innerJoin(animal, eq(animal.id, tratamento.animalId))
        .where(and(eq(tratamento.organizationId, orgId), lte(tratamento.inicio, hoje), or(isNull(tratamento.fim), gte(tratamento.fim, hoje))))
        .orderBy(desc(tratamento.inicio));
      const ids = [...new Set(rows.map((r) => r.animalId))];
      const proximas = ids.length
        ? await db
            .select({ animalId: consulta.animalId, data: consulta.data, hora: consulta.hora, tipo: consulta.tipo })
            .from(consulta)
            .where(and(inArray(consulta.animalId, ids), gte(consulta.data, hoje), ne(consulta.status, "cancelada"), ne(consulta.status, "concluida")))
            .orderBy(asc(consulta.data), asc(consulta.hora))
        : [];
      const linhas = rows.map((r) => {
        const p = proximas.find((x) => x.animalId === r.animalId);
        const tipoC = p ? ROTULO_TIPO_CONSULTA[tipoConsultaSchema.catch("outro").parse(p.tipo)] : null;
        return {
          animalId: r.animalId,
          alvo: rotuloAnimal(r),
          desde: dm(r.inicio),
          remedio: [r.remedio, r.dose].filter(Boolean).join(", "),
          ate: r.fim ? dm(r.fim) : null,
          proximo: p ? `${tipoC} ${p.data === hoje ? "hoje" : dm(p.data)}, ${p.hora}` : null,
        };
      });
      const n = ids.length;
      rel = { tipo: "tratamento", resumo: n ? `${n} ${n === 1 ? "animal" : "animais"} em tratamento agora.` : "Nenhum animal em tratamento agora.", linhas };
      break;
    }

    case "ocorrencias": {
      const criador = alias(user, "criador");
      const rows = await db
        .select({ nome: criador.name, status: ocorrencia.status, n: count(ocorrencia.id) })
        .from(ocorrencia)
        .leftJoin(criador, eq(criador.id, ocorrencia.criadoPorId))
        .where(
          and(
            eq(ocorrencia.organizationId, orgId),
            gte(ocorrencia.createdAt, new Date(`${de}T00:00:00-03:00`)),
            lte(ocorrencia.createdAt, new Date(`${ate}T23:59:59-03:00`)),
          ),
        )
        .groupBy(criador.name, ocorrencia.status);
      const porPessoa = new Map<string, { nome: string; gravadas: number; salvas: number; descartadas: number }>();
      for (const r of rows) {
        const nome = r.nome ?? "Sem nome";
        const p = porPessoa.get(nome) ?? { nome, gravadas: 0, salvas: 0, descartadas: 0 };
        p.gravadas += r.n;
        if (r.status === "confirmada") p.salvas += r.n;
        if (r.status === "descartada") p.descartadas += r.n;
        porPessoa.set(nome, p);
      }
      const linhas = [...porPessoa.values()].sort((a, b) => b.gravadas - a.gravadas);
      const total = linhas.reduce((t, l) => t + l.gravadas, 0);
      const salvas = linhas.reduce((t, l) => t + l.salvas, 0);
      rel = {
        tipo: "ocorrencias",
        resumo: total
          ? `${total} ${total === 1 ? "nota gravada" : "notas gravadas"}, ${salvas} ${salvas === 1 ? "salva" : "salvas"} no sistema · ${nomePeriodo}`
          : `Nenhuma nota gravada · ${nomePeriodo}`,
        linhas,
      };
      break;
    }
  }

  return c.json(rel);
});

