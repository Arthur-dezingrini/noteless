"use client";

import { CATEGORIAS_PRODUTO, ROTULO_CATEGORIA_PRODUTO, type Local, type SaldoProduto } from "@vocare/shared";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClass, Card, cx, SegmentedControl, tabela } from "@/components/ui";

import { dataBr, qtd } from "./comum";
import { SaidaModal, TransferenciaModal } from "./lancar";

type Acao = { tipo: "saida" | "transferencia"; saldo: SaldoProduto } | null;

/** Saldo de cada produto: total, por local, quantos dias a ração aguenta e a validade mais próxima. */
export function SaldoPainel({ orgId, saldo, locais, categoria }: { orgId: string; saldo: SaldoProduto[]; locais: Local[]; categoria: string }) {
  const router = useRouter();
  const [acao, setAcao] = useState<Acao>(null);
  const pronto = () => {
    setAcao(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Categoria"
          value={categoria}
          onChange={(c) => router.push((c ? `/estoque?categoria=${c}` : "/estoque") as Route)}
          items={[{ value: "", label: "Todas" }, ...CATEGORIAS_PRODUTO.map((c) => ({ value: c, label: ROTULO_CATEGORIA_PRODUTO[c] }))]}
        />
        <Link href="/estoque/entradas" className={buttonClass("primario")}>
          Lançar entrada
        </Link>
      </div>

      {saldo.length === 0 ? (
        <Card padded className="text-sm text-ink-muted">
          Nenhum produto ainda. Comece cadastrando os produtos e os locais.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Produto</th>
                <th className={tabela.th}>Saldo</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>Por local</th>
                <th className={cx(tabela.th, "hidden lg:table-cell")}>Dura</th>
                <th className={cx(tabela.th, "hidden lg:table-cell")}>Validade</th>
                <th className="w-40 px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {saldo.map((s) => {
                const { produto: p } = s;
                const abaixo = p.estoqueMinimo != null && s.total < p.estoqueMinimo;
                return (
                  <tr key={p.id} className={tabela.linha}>
                    <td className={tabela.td}>
                      <span className="block font-semibold text-ink">{p.nome}</span>
                      <span className="block text-sm text-ink-muted">{ROTULO_CATEGORIA_PRODUTO[p.categoria]}</span>
                    </td>
                    <td className={cx(tabela.td, "tabular-nums", s.total < 0 ? "font-semibold text-danger" : abaixo ? "font-semibold text-warn" : "text-ink")}>
                      {qtd(s.total, p.unidade)}
                      {abaixo && <span className="block text-sm font-normal">abaixo do mínimo</span>}
                    </td>
                    <td className={cx(tabela.td, "hidden text-sm md:table-cell")}>
                      {s.porLocal.length === 0
                        ? "—"
                        : s.porLocal.map((l) => (
                            <span key={l.localId} className={cx("block", l.quantidade < 0 && "text-danger")}>
                              {l.localNome}: {qtd(l.quantidade, p.unidade)}
                            </span>
                          ))}
                    </td>
                    <td className={cx(tabela.td, "hidden tabular-nums lg:table-cell")}>
                      {s.diasRestantes == null ? "—" : `${s.diasRestantes} ${s.diasRestantes === 1 ? "dia" : "dias"}`}
                    </td>
                    <td className={cx(tabela.td, "hidden lg:table-cell")}>{s.validadeMaisProxima ? dataBr(s.validadeMaisProxima) : "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <button type="button" onClick={() => setAcao({ tipo: "saida", saldo: s })} className={buttonClass("linha")}>
                        Saída
                      </button>
                      <button type="button" onClick={() => setAcao({ tipo: "transferencia", saldo: s })} className={buttonClass("linha")}>
                        Transferir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {acao?.tipo === "saida" && <SaidaModal orgId={orgId} saldo={acao.saldo} locais={locais} onClose={() => setAcao(null)} onDone={pronto} />}
      {acao?.tipo === "transferencia" && (
        <TransferenciaModal orgId={orgId} saldo={acao.saldo} locais={locais} onClose={() => setAcao(null)} onDone={pronto} />
      )}
    </div>
  );
}
