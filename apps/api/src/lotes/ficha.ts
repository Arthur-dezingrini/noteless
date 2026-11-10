import {
  avesVivas,
  consolidarSemanas,
  indicadoresDoDia,
  indicadoresDoLote,
  type ApontamentoDia,
  type FichaLote,
  type PesagemSemana,
} from "@vocare/shared";
import { asc, eq } from "drizzle-orm";

import { hojeISO, noDia } from "../base/datas";
import { db } from "../db";
import { alojamento, apontamentoAviario, instalacao, lote, pesagemLote, vacinacaoLote } from "../db/tabelas/aviario";
import { listarLotes } from "./resumo";

const num = (v: string | null) => (v === null ? null : Number(v));

/** Ficha completa do lote (diário por galpão, semanas, pesagens, vacinações), ou `null` se não for desta organização. */
export async function montarFicha(orgId: string, id: string): Promise<FichaLote | null> {
  const [resumo] = await listarLotes(orgId, { id });
  if (!resumo) return null;
  const [l] = await db.select().from(lote).where(eq(lote.id, id));
  if (!l) return null;

  const alojs = await db
    .select({
      id: alojamento.id,
      instalacaoId: alojamento.instalacaoId,
      instalacaoNome: instalacao.nome,
      inicio: alojamento.inicio,
      fim: alojamento.fim,
      femeas: alojamento.femeas,
      machos: alojamento.machos,
    })
    .from(alojamento)
    .innerJoin(instalacao, eq(instalacao.id, alojamento.instalacaoId))
    .where(eq(alojamento.loteId, id))
    .orderBy(asc(alojamento.inicio), asc(instalacao.nome));
  const linhas = await db.select().from(apontamentoAviario).where(eq(apontamentoAviario.loteId, id));
  const pesagens = await db.select().from(pesagemLote).where(eq(pesagemLote.loteId, id)).orderBy(asc(pesagemLote.data));
  const vacinacoes = await db.select().from(vacinacaoLote).where(eq(vacinacaoLote.loteId, id)).orderBy(asc(vacinacaoLote.data));

  const dele: ApontamentoDia[] = linhas.map((a) => ({
    data: a.data,
    instalacaoId: a.instalacaoId,
    mortasFemeas: a.mortasFemeas,
    mortasMachos: a.mortasMachos,
    eliminadasFemeas: a.eliminadasFemeas,
    eliminadasMachos: a.eliminadasMachos,
    ovosTotal: a.ovosTotal,
    ovosIncubaveis: a.ovosIncubaveis,
    ovosTrincados: a.ovosTrincados,
    ovosSujos: a.ovosSujos,
    ovosDuasGemas: a.ovosDuasGemas,
    ovosDescarte: a.ovosDescarte,
    racaoKg: num(a.racaoKg),
    aguaL: num(a.aguaL),
  }));

  const diario = linhas
    .map((a, i) => {
      const aloj = alojs.find((x) => x.instalacaoId === a.instalacaoId && x.inicio <= a.data && (x.fim === null || x.fim >= a.data));
      const antes = dele.filter((d) => d.instalacaoId === a.instalacaoId && aloj && d.data >= aloj.inicio && d.data < a.data);
      const vivas = aloj ? avesVivas({ femeas: aloj.femeas, machos: aloj.machos }, antes, noDia(a.data, -1)) : { femeas: 0, machos: 0 };
      return {
        data: a.data,
        instalacaoId: a.instalacaoId,
        instalacaoNome: aloj?.instalacaoNome ?? "",
        ocorrenciaId: a.ocorrenciaId,
        valores: {
          mortasFemeas: a.mortasFemeas,
          mortasMachos: a.mortasMachos,
          eliminadasFemeas: a.eliminadasFemeas,
          eliminadasMachos: a.eliminadasMachos,
          ovosTotal: a.ovosTotal,
          ovosIncubaveis: a.ovosIncubaveis,
          ovosTrincados: a.ovosTrincados,
          ovosSujos: a.ovosSujos,
          ovosDuasGemas: a.ovosDuasGemas,
          ovosDescarte: a.ovosDescarte,
          racaoKg: num(a.racaoKg),
          aguaL: num(a.aguaL),
          observacoes: a.observacoes,
        },
        indicadores: indicadoresDoDia(dele[i]!, vivas),
      };
    })
    .sort((x, y) => (x.data === y.data ? x.instalacaoNome.localeCompare(y.instalacaoNome) : x.data < y.data ? -1 : 1));

  const dadosPesagens: PesagemSemana[] = pesagens.map((p) => ({
    data: p.data,
    sexo: p.sexo as "femea" | "macho",
    pesoMedioG: Number(p.pesoMedioG),
    uniformidadePct: num(p.uniformidadePct),
  }));

  return {
    lote: {
      ...resumo,
      idadeAlojamentoDias: l.idadeAlojamentoDias,
      femeasIniciais: l.femeasIniciais,
      machosIniciais: l.machosIniciais,
      dataEncerramento: l.dataEncerramento,
    },
    alojamentos: alojs,
    indicadores: indicadoresDoLote(l, dele, hojeISO()),
    diario,
    semanal: consolidarSemanas(l, dele, dadosPesagens),
    pesagens: pesagens.map((p, i) => ({
      id: p.id,
      data: p.data,
      sexo: p.sexo as "femea" | "macho",
      pesoMedioG: dadosPesagens[i]!.pesoMedioG,
      uniformidadePct: dadosPesagens[i]!.uniformidadePct,
      amostra: p.amostra,
      ocorrenciaId: p.ocorrenciaId,
    })),
    vacinacoes: vacinacoes.map((v) => ({
      id: v.id,
      data: v.data,
      vacina: v.vacina,
      via: v.via,
      proximaData: v.proximaData,
      ocorrenciaId: v.ocorrenciaId,
    })),
  };
}
