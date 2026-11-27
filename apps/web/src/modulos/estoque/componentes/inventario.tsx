"use client";

import type { Inventario, InventarioResumo, Local, Produto } from "@vocare/shared";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button, buttonClass, Card, cx, FormMessage, Input, Select, tabela } from "@/components/ui";

import { dataBr, enviar, lerNumero, qtd } from "./comum";
import { FormModal } from "./form-modal";

const STATUS = { aberto: "Aberto", fechado: "Fechado", cancelado: "Cancelado" } as const;

/** Lista de inventários, abrir um novo e a contagem do inventário escolhido. */
export function InventarioPainel({
  orgId,
  inventarios,
  atual,
  locais,
  produtos,
}: {
  orgId: string;
  inventarios: InventarioResumo[];
  atual: Inventario | null;
  locais: Local[];
  produtos: Produto[];
}) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const ativos = locais.filter((l) => l.ativo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primario" onClick={() => setAbrindo(true)}>
          Abrir inventário
        </Button>
      </div>

      {atual && <Contagem key={atual.id} orgId={orgId} inv={atual} produtos={produtos} />}

      {inventarios.length === 0 ? (
        <Card padded className="text-sm text-ink-muted">
          Nenhum inventário ainda. Abra um para contar o que tem num local e acertar o saldo.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Local</th>
                <th className={tabela.th}>Aberto em</th>
                <th className={tabela.th}>Situação</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>Itens contados</th>
                <th className="w-20 px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {inventarios.map((i) => (
                <tr key={i.id} className={cx(tabela.linha, i.id === atual?.id && "bg-hover")}>
                  <td className={cx(tabela.td, "font-semibold text-ink")}>{i.localNome}</td>
                  <td className={cx(tabela.td, "tabular-nums")}>{dataBr(i.abertoEm)}</td>
                  <td className={tabela.td}>{STATUS[i.status]}</td>
                  <td className={cx(tabela.td, "hidden tabular-nums md:table-cell")}>{i.contados}</td>
                  <td className="px-3 py-3">
                    <Link href={`/estoque/inventario?id=${i.id}` as Route} className={buttonClass("linha")}>
                      {i.status === "aberto" ? "Contar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {abrindo && (
        <FormModal
          titulo="Abrir inventário"
          subtitulo="Um local por vez. Enquanto estiver aberto, os lançamentos continuam normais."
          confirmar="Abrir"
          campos={[{ nome: "localId", rotulo: "Local", tipo: "opcoes", padrao: ativos[0]?.id, opcoes: ativos.map((l) => ({ valor: l.id, rotulo: l.nome })) }]}
          salvar={async (v) => {
            const r = await enviar<Inventario>(`/api/org/${orgId}/estoque/inventarios`, v);
            if (!r.ok) return r.erro;
            router.push(`/estoque/inventario?id=${r.data.id}` as Route);
            return null;
          }}
          onClose={() => setAbrindo(false)}
          onDone={() => {
            setAbrindo(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

type Extra = { chave: number; produtoId: string };

function Contagem({ orgId, inv, produtos }: { orgId: string; inv: Inventario; produtos: Produto[] }) {
  const router = useRouter();
  const [extras, setExtras] = useState<Extra[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const aberto = inv.status === "aberto";
  const raiz = `/api/org/${orgId}/estoque/inventarios/${inv.id}`;

  /** Só vai o que tem número; vazio = não contado. */
  function lerContagem(form: FormData) {
    const itens = [];
    for (const [i, item] of inv.itens.entries()) {
      const n = lerNumero(form.get(`c-${i}`));
      if (n == null) continue;
      if (Number.isNaN(n)) return `Número inválido em ${item.produtoNome}.`;
      itens.push({ produtoId: item.produtoId, loteFabricacao: item.loteFabricacao, quantidadeContada: n });
    }
    for (const x of extras) {
      const n = lerNumero(form.get(`x-${x.chave}`));
      if (n == null) continue;
      if (Number.isNaN(n)) return "Número inválido num produto adicionado.";
      itens.push({ produtoId: x.produtoId, loteFabricacao: String(form.get(`xl-${x.chave}`) ?? "").trim(), quantidadeContada: n });
    }
    return itens;
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fechar = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "fechar";
    setErro(null);
    const itens = lerContagem(new FormData(e.currentTarget));
    if (typeof itens === "string") return setErro(itens);
    if (fechar && !window.confirm("Fechar o inventário? As diferenças viram ajuste no estoque e não dá para contar de novo.")) return;
    start(async () => {
      const salvo = await enviar(`${raiz}/itens`, itens, "PUT");
      if (!salvo.ok) return setErro(salvo.erro);
      if (fechar) {
        const r = await enviar(`${raiz}/fechar`, {});
        if (!r.ok) return setErro(r.erro);
      }
      setExtras([]);
      router.refresh();
    });
  }

  function cancelar() {
    if (!window.confirm("Cancelar o inventário? Nada muda no estoque.")) return;
    start(async () => {
      const r = await enviar(`${raiz}/cancelar`, {});
      if (!r.ok) return setErro(r.erro);
      router.refresh();
    });
  }

  return (
    <Card padded>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Inventário de {inv.localNome}</h2>
          <p className="text-sm text-ink-muted">
            {STATUS[inv.status]} · aberto em {dataBr(inv.abertoEm)}
            {inv.fechadoEm && ` · fechado em ${dataBr(inv.fechadoEm)}`}
            {aberto && " · deixe vazio o que não contou"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Produto</th>
                <th className={tabela.th}>Sistema</th>
                <th className={tabela.th}>Contado</th>
                <th className={tabela.th}>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {inv.itens.map((item, i) => {
                const sistema = aberto ? item.saldoAtual : item.quantidadeSistema;
                return (
                  <tr key={`${item.produtoId}|${item.loteFabricacao}`} className={tabela.linha}>
                    <td className={tabela.td}>
                      <span className="block font-semibold text-ink">{item.produtoNome}</span>
                      {item.loteFabricacao && <span className="block text-sm text-ink-muted">Lote {item.loteFabricacao}</span>}
                    </td>
                    <td className={cx(tabela.td, "tabular-nums")}>{sistema == null ? "—" : qtd(sistema, item.unidade)}</td>
                    <td className={tabela.td}>
                      {aberto ? (
                        <Input name={`c-${i}`} inputMode="decimal" defaultValue={item.quantidadeContada == null ? "" : String(item.quantidadeContada).replace(".", ",")} className="w-28" />
                      ) : item.quantidadeContada == null ? (
                        "—"
                      ) : (
                        qtd(item.quantidadeContada, item.unidade)
                      )}
                    </td>
                    <td className={cx(tabela.td, "tabular-nums", item.diferenca != null && item.diferenca !== 0 && "font-semibold")}>
                      {item.diferenca == null ? "—" : `${item.diferenca > 0 ? "+" : ""}${qtd(item.diferenca, item.unidade)}`}
                    </td>
                  </tr>
                );
              })}
              {extras.map((x) => (
                <tr key={x.chave} className={tabela.linha}>
                  <td className={tabela.td}>
                    <Select value={x.produtoId} onChange={(e) => setExtras(extras.map((y) => (y.chave === x.chave ? { ...y, produtoId: e.target.value } : y)))}>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </Select>
                    <Input name={`xl-${x.chave}`} placeholder="Lote (opcional)" className="mt-2" />
                  </td>
                  <td className={tabela.td}>—</td>
                  <td className={tabela.td}>
                    <Input name={`x-${x.chave}`} inputMode="decimal" className="w-28" />
                  </td>
                  <td className={tabela.td}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {erro && <FormMessage>{erro}</FormMessage>}
        {aberto && (
          <div className="flex flex-wrap gap-2">
            <Button variant="fantasma" onClick={() => setExtras([...extras, { chave: Date.now(), produtoId: produtos[0]?.id ?? "" }])}>
              Achou outro produto
            </Button>
            <Button type="submit" value="salvar" loading={pending}>
              Salvar contagem
            </Button>
            <Button type="submit" value="fechar" variant="primario" loading={pending}>
              Fechar e ajustar o estoque
            </Button>
            <Button variant="perigo" onClick={cancelar}>
              Cancelar inventário
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
