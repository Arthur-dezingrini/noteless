"use client";

import type { Entrada, Fornecedor, Local, Produto } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button, buttonClass, Card, cx, Field, FormMessage, Input, Modal, ModalFooter, Select, tabela } from "@/components/ui";
import { hojeISO } from "@/lib/datas";

import { dataBr, dinheiro, enviar, lerNumero, qtd } from "./comum";
import { EstornoModal } from "./lancar";

type Props = { orgId: string; entradas: Entrada[]; produtos: Produto[]; locais: Local[]; fornecedores: Fornecedor[] };

/** Compras lançadas e o lançamento de uma nova entrada. */
export function EntradasLista({ orgId, entradas, produtos, locais, fornecedores }: Props) {
  const router = useRouter();
  const [nova, setNova] = useState(false);
  const [estornando, setEstornando] = useState<Entrada | null>(null);
  const pronto = () => {
    setNova(false);
    setEstornando(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primario" onClick={() => setNova(true)}>
          Nova entrada
        </Button>
      </div>

      {entradas.length === 0 ? (
        <Card padded className="text-sm text-ink-muted">
          Nenhuma entrada lançada ainda.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Data</th>
                <th className={tabela.th}>Itens</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>Fornecedor</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>Nota</th>
                <th className={cx(tabela.th, "hidden lg:table-cell")}>Valor</th>
                <th className="w-24 px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.id} className={cx(tabela.linha, e.estornadaEm && "opacity-60")}>
                  <td className={cx(tabela.td, "tabular-nums")}>
                    {dataBr(e.data)}
                    {e.estornadaEm && <span className="block text-sm text-ink-muted">Estornada</span>}
                  </td>
                  <td className={cx(tabela.td, "text-sm")}>
                    {e.itens.map((i) => (
                      <span key={i.id} className="block">
                        {i.produtoNome}: {qtd(i.quantidade, i.unidade)} em {i.localNome}
                        {i.loteFabricacao && ` (lote ${i.loteFabricacao})`}
                      </span>
                    ))}
                  </td>
                  <td className={cx(tabela.td, "hidden md:table-cell")}>{e.fornecedorNome ?? "—"}</td>
                  <td className={cx(tabela.td, "hidden md:table-cell")}>{e.numeroNota ?? "—"}</td>
                  <td className={cx(tabela.td, "hidden tabular-nums lg:table-cell")}>{e.valorTotal == null ? "—" : dinheiro(e.valorTotal)}</td>
                  <td className="px-3 py-3">
                    {!e.estornadaEm && (
                      <button type="button" onClick={() => setEstornando(e)} className={buttonClass("linha")}>
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

      {nova && <EntradaModal orgId={orgId} produtos={produtos} locais={locais} fornecedores={fornecedores} onClose={() => setNova(false)} onDone={pronto} />}
      {estornando && (
        <EstornoModal
          caminho={`/api/org/${orgId}/estoque/entradas/${estornando.id}/estorno`}
          descricao={`Entrada de ${dataBr(estornando.data)}${estornando.numeroNota ? `, nota ${estornando.numeroNota}` : ""}: todos os itens saem do saldo.`}
          onClose={() => setEstornando(null)}
          onDone={pronto}
        />
      )}
    </div>
  );
}

type Item = { chave: number; produtoId: string };

function EntradaModal({ orgId, produtos, locais, fornecedores, onClose, onDone }: Omit<Props, "entradas"> & { onClose: () => void; onDone: () => void }) {
  const ativos = produtos.filter((p) => p.ativo);
  const [itens, setItens] = useState<Item[]>([{ chave: 0, produtoId: ativos[0]?.id ?? "" }]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const produtoDe = (id: string) => produtos.find((p) => p.id === id);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const linhas: Record<string, string | number | null>[] = [];
    for (const it of itens) {
      const campo = (n: string) => form.get(`${n}-${it.chave}`);
      const quantidade = lerNumero(campo("quantidade"));
      const fator = lerNumero(campo("fator")) ?? 1;
      const custoTotal = lerNumero(campo("custoTotal"));
      if (quantidade == null || Number.isNaN(quantidade) || Number.isNaN(fator) || Number.isNaN(custoTotal)) return setErro("Confira os números dos itens.");
      linhas.push({
        produtoId: it.produtoId,
        localId: String(campo("localId") ?? ""),
        quantidade,
        fator,
        custoTotal,
        loteFabricacao: String(campo("loteFabricacao") ?? "").trim() || null,
        validade: String(campo("validade") ?? "") || null,
      });
    }
    const texto = (n: string) => String(form.get(n) ?? "").trim() || null;
    start(async () => {
      const r = await enviar(`/api/org/${orgId}/estoque/entradas`, {
        fornecedorId: texto("fornecedorId"),
        numeroNota: texto("numeroNota"),
        data: texto("data"),
        itens: linhas,
      });
      if (!r.ok) return setErro(r.erro);
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title="Nova entrada" subtitle="Uma compra pode ter vários itens.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Fornecedor" hint="(opcional)">
            <Select name="fornecedorId" defaultValue="">
              <option value="">Nenhum</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nota" hint="(opcional)">
            <Input name="numeroNota" />
          </Field>
          <Field label="Data">
            <Input name="data" type="date" defaultValue={hojeISO()} />
          </Field>
        </div>

        {itens.map((it) => {
          const p = produtoDe(it.produtoId);
          return (
            <Card key={it.chave} padded className="grid gap-3 sm:grid-cols-2">
              <Field label="Produto">
                <Select
                  value={it.produtoId}
                  onChange={(e) => setItens(itens.map((x) => (x.chave === it.chave ? { ...x, produtoId: e.target.value } : x)))}
                >
                  {ativos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Local">
                <Select name={`localId-${it.chave}`}>
                  {locais
                    .filter((l) => l.ativo)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Quantidade" hint={p?.embalagemNome ? `(em ${p.embalagemNome} ou ${p.unidade})` : p ? `(${p.unidade})` : undefined}>
                <Input name={`quantidade-${it.chave}`} inputMode="decimal" />
              </Field>
              <Field label={`Fator (${p?.unidade ?? "un."} por unidade comprada)`} hint="(1 se já está na unidade de estoque)">
                <Input key={it.produtoId} name={`fator-${it.chave}`} inputMode="decimal" defaultValue={p?.embalagemFator ? String(p.embalagemFator).replace(".", ",") : "1"} />
              </Field>
              <Field label="Valor do item (R$)" hint="(opcional)">
                <Input name={`custoTotal-${it.chave}`} inputMode="decimal" />
              </Field>
              {p?.controlaLote && (
                <>
                  <Field label="Lote de fabricação">
                    <Input name={`loteFabricacao-${it.chave}`} />
                  </Field>
                  <Field label="Validade">
                    <Input name={`validade-${it.chave}`} type="date" />
                  </Field>
                </>
              )}
              {itens.length > 1 && (
                <div className="flex items-end">
                  <Button variant="fantasma" onClick={() => setItens(itens.filter((x) => x.chave !== it.chave))}>
                    Tirar item
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
        <div>
          <Button variant="fantasma" onClick={() => setItens([...itens, { chave: Date.now(), produtoId: ativos[0]?.id ?? "" }])}>
            Adicionar item
          </Button>
        </div>

        {erro && <FormMessage>{erro}</FormMessage>}
        <ModalFooter>
          <Button variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primario" loading={pending}>
            Lançar entrada
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
