import { CAMPOS_APONTAMENTO, type Operacao } from "@vocare/shared";
import { and, eq } from "drizzle-orm";

import { br } from "../base/datas";
import { lote, pesagemLote, vacinacaoLote } from "../db/tabelas/aviario";
import { nomeDaInstalacao, type Tx } from "./alojamento";
import { somarApontamento, validarApontamento, type ValoresApontamento } from "./apontamento";

type Origem = { organizationId: string; ocorrenciaId: string; criadoPorId: string };

/** Confere que o lote é da organização e ainda estava ativo no dia. */
async function loteAtivoNaData(tx: Tx, orgId: string, loteId: string | null, data: string): Promise<string | null> {
  if (!loteId) return "Operação sem lote do cadastro não pode ser aplicada.";
  const [l] = await tx.select().from(lote).where(and(eq(lote.id, loteId), eq(lote.organizationId, orgId)));
  if (!l) return "Lote não encontrado nesta organização.";
  if (l.dataEncerramento && data > l.dataEncerramento) return `O lote ${l.codigo} foi encerrado em ${br(l.dataEncerramento)}.`;
  return null;
}

/**
 * Aplica uma operação do aviário já confirmada. Devolve a mensagem do que está
 * errado, ou null. `data: null` na operação vale `diaGravacao` (o dia em que a
 * nota foi gravada, não o da confirmação); `hoje` serve só para barrar data futura.
 */
export async function aplicarAviario(
  tx: Tx,
  op: Operacao,
  origem: Origem,
  hoje: string,
  diaGravacao: string = hoje,
): Promise<string | null> {
  const orgId = origem.organizationId;

  if (op.tipo === "apontar_galpao") {
    if (!op.instalacaoId) return "Operação sem galpão do cadastro não pode ser aplicada.";
    if (!(await nomeDaInstalacao(tx, orgId, op.instalacaoId))) return "Galpão não encontrado nesta organização.";
    const data = op.data ?? diaGravacao;
    const valores: Record<string, unknown> = { observacoes: op.observacoes };
    for (const c of CAMPOS_APONTAMENTO) valores[c] = op[c];
    const v = valores as ValoresApontamento;
    const r = await validarApontamento(tx, orgId, op.instalacaoId, data, v, "somar");
    if (typeof r === "string") return r;
    await somarApontamento(tx, origem, op.instalacaoId, r.loteId, data, v);
    return null;
  }

  if (op.tipo === "pesar_lote") {
    if (op.pesoMedioG == null) return "Informe o peso médio.";
    const data = op.data ?? diaGravacao;
    if (data > hoje) return "Data no futuro.";
    const erro = await loteAtivoNaData(tx, orgId, op.loteId, data);
    if (erro) return erro;
    await tx.insert(pesagemLote).values({
      organizationId: orgId,
      criadoPorId: origem.criadoPorId,
      ocorrenciaId: origem.ocorrenciaId,
      loteId: op.loteId!,
      instalacaoId: null,
      data,
      sexo: op.sexo,
      pesoMedioG: String(op.pesoMedioG),
      uniformidadePct: op.uniformidadePct == null ? null : String(op.uniformidadePct),
      amostra: op.amostra ?? null,
    });
    return null;
  }

  if (op.tipo === "vacinar_lote") {
    if (!op.vacina.trim()) return "Informe a vacina.";
    const data = op.data ?? diaGravacao;
    if (data > hoje) return "Data no futuro.";
    const erro = await loteAtivoNaData(tx, orgId, op.loteId, data);
    if (erro) return erro;
    await tx.insert(vacinacaoLote).values({
      organizationId: orgId,
      criadoPorId: origem.criadoPorId,
      ocorrenciaId: origem.ocorrenciaId,
      loteId: op.loteId!,
      vacina: op.vacina,
      via: op.via ?? null,
      data,
      proximaData: op.proximaData ?? null,
    });
    return null;
  }

  return "Operação do aviário desconhecida.";
}
