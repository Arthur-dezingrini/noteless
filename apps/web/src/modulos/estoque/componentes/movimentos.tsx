"use client";

import { ORIGENS_MOVIMENTO, type Local, type Movimento, type PaginaMovimentos, type Produto } from "@vocare/shared";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, buttonClass, Card, cx, Field, Input, Select, tabela } from "@/components/ui";

import { dataBr, qtd, ROTULO_ORIGEM, ROTULO_TIPO_MOVIMENTO } from "./comum";
import { EstornoModal } from "./lancar";

type Filtro = Record<string, string | undefined>;

/** O livro do estoque com filtros; a busca por lote de fabricação é o rastreio. */
export function MovimentosLista({
  orgId,
  pagina,
  numero,
  filtro,
  produtos,
  locais,
}: {
  orgId: string;
  pagina: PaginaMovimentos;
  numero: number;
  filtro: Filtro;
  produtos: Produto[];
  locais: Local[];
}) {
  const router = useRouter();
  const [estornando, setEstornando] = useState<Movimento | null>(null);

  const ir = (f: Filtro, n = 1) => {
    const q = new URLSearchParams(Object.entries({ ...f, pagina: n > 1 ? String(n) : undefined }).filter((e): e is [string, string] => !!e[1]));
    router.push(`/estoque/movimentos${q.size ? `?${q}` : ""}` as Route);
  };
  function filtrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    ir(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v).trim() || undefined])));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padded>
        <form onSubmit={filtrar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Produto">
            <Select name="produtoId" defaultValue={filtro.produtoId ?? ""}>
              <option value="">Todos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Local">
            <Select name="localId" defaultValue={filtro.localId ?? ""}>
              <option value="">Todos</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Origem">
            <Select name="origemTipo" defaultValue={filtro.origemTipo ?? ""}>
              <option value="">Todas</option>
              {ORIGENS_MOVIMENTO.map((o) => (
                <option key={o} value={o}>
                  {ROTULO_ORIGEM[o]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lote de fabricação">
            <Input name="loteFabricacao" defaultValue={filtro.loteFabricacao ?? ""} />
          </Field>
          <Field label="De">
            <Input name="de" type="date" defaultValue={filtro.de ?? ""} />
          </Field>
          <Field label="Até">
            <Input name="ate" type="date" defaultValue={filtro.ate ?? ""} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primario">
              Filtrar
            </Button>
            <Button variant="fantasma" onClick={() => ir({})}>
              Limpar
            </Button>
          </div>
        </form>
      </Card>

      {pagina.itens.length === 0 ? (
        <Card padded className="text-sm text-ink-muted">
          Nenhum movimento com esses filtros.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Data</th>
                <th className={tabela.th}>Produto</th>
                <th className={tabela.th}>Quantidade</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>Local</th>
                <th className={cx(tabela.th, "hidden lg:table-cell")}>Lote</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>Origem</th>
                <th className={cx(tabela.th, "hidden lg:table-cell")}>Quem</th>
                <th className="w-24 px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagina.itens.map((m) => (
                <tr key={m.id} className={cx(tabela.linha, m.estornado && "opacity-60")}>
                  <td className={cx(tabela.td, "tabular-nums")}>{dataBr(m.data)}</td>
                  <td className={tabela.td}>
                    <span className="block font-semibold text-ink">{m.produtoNome}</span>
                    <span className="block text-sm text-ink-muted">
                      {ROTULO_TIPO_MOVIMENTO[m.tipo]}
                      {m.estornado && " · estornado"}
                      {m.motivo && ` · ${m.motivo}`}
                    </span>
                  </td>
                  <td className={cx(tabela.td, "tabular-nums", m.quantidade < 0 ? "text-ink" : "text-brand")}>
                    {m.quantidade > 0 ? "+" : ""}
                    {qtd(m.quantidade, m.unidade)}
                  </td>
                  <td className={cx(tabela.td, "hidden md:table-cell")}>{m.localNome}</td>
                  <td className={cx(tabela.td, "hidden lg:table-cell")}>{m.loteFabricacao || "—"}</td>
                  <td className={cx(tabela.td, "hidden md:table-cell")}>{ROTULO_ORIGEM[m.origemTipo]}</td>
                  <td className={cx(tabela.td, "hidden lg:table-cell")}>{m.criadoPorNome ?? "—"}</td>
                  <td className="px-3 py-3">
                    {!m.estornado && m.tipo !== "estorno" && (
                      <button type="button" onClick={() => setEstornando(m)} className={buttonClass("linha")}>
                        Estornar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(numero > 1 || pagina.temMais) && (
        <div className="flex justify-between">
          <Button variant="fantasma" disabled={numero <= 1} onClick={() => ir(filtro, numero - 1)}>
            Anteriores
          </Button>
          <Button variant="fantasma" disabled={!pagina.temMais} onClick={() => ir(filtro, numero + 1)}>
            Mais antigos
          </Button>
        </div>
      )}

      {estornando && (
        <EstornoModal
          caminho={`/api/org/${orgId}/estoque/movimentos/${estornando.id}/estorno`}
          descricao={`${ROTULO_TIPO_MOVIMENTO[estornando.tipo]} de ${qtd(estornando.quantidade, estornando.unidade)} de ${estornando.produtoNome} em ${dataBr(estornando.data)}.`}
          onClose={() => setEstornando(null)}
          onDone={() => {
            setEstornando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
