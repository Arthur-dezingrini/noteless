"use client";

import type { Local, PreEntradaNfe, Produto } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";

import { Button, Card, cx, Field, FormMessage, Input, Select, tabela } from "@/components/ui";

import { dataBr, dinheiro, enviar, lerNumero } from "./comum";

/** Importar NF-e: sobe o XML, confere cada item (produto, fator, local) e confirma a entrada. */
export function NfeImportar({ orgId, produtos, locais }: { orgId: string; produtos: Produto[]; locais: Local[] }) {
  const router = useRouter();
  const [xml, setXml] = useState<string | null>(null);
  const [nota, setNota] = useState<PreEntradaNfe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ativos = produtos.filter((p) => p.ativo);
  const locaisAtivos = locais.filter((l) => l.ativo);
  const raiz = `/api/org/${orgId}/estoque/nfe`;

  async function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    setErro(null);
    setNota(null);
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const texto = await arquivo.text();
    start(async () => {
      const r = await enviar<PreEntradaNfe>(`${raiz}/ler`, { xml: texto });
      if (!r.ok) return setErro(r.erro);
      setXml(texto);
      setNota(r.data);
    });
  }

  function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nota || !xml) return;
    setErro(null);
    const form = new FormData(e.currentTarget);
    const itens: Record<string, unknown>[] = [];
    for (const [i, item] of nota.itens.entries()) {
      if (form.get(`usar-${i}`) !== "on") continue;
      const fator = lerNumero(form.get(`fator-${i}`));
      if (fator == null || Number.isNaN(fator) || fator <= 0) return setErro(`Confira o fator de ${item.descricao}.`);
      // Lotes da nota (corrigíveis na tela) ou, se a nota não traz, o lote digitado para o item inteiro.
      let lotes: { lote: string; quantidade: number; validade: string | null }[] | undefined;
      if (item.lotes.length > 0) {
        lotes = [];
        for (const j of item.lotes.keys()) {
          const lote = String(form.get(`lote-${i}-${j}`) ?? "").trim();
          const quantidade = lerNumero(form.get(`qlote-${i}-${j}`));
          if (!lote || quantidade == null || Number.isNaN(quantidade) || quantidade <= 0) return setErro(`Confira os lotes de ${item.descricao}.`);
          lotes.push({ lote, quantidade, validade: String(form.get(`val-${i}-${j}`) ?? "") || null });
        }
      } else {
        const lote = String(form.get(`lote-${i}`) ?? "").trim();
        if (lote) lotes = [{ lote, quantidade: item.quantidade, validade: String(form.get(`validade-${i}`) ?? "") || null }];
      }
      itens.push({
        indice: i,
        produtoId: String(form.get(`produto-${i}`) ?? ""),
        localId: String(form.get(`local-${i}`) ?? ""),
        fator,
        ...(lotes ? { lotes } : {}),
      });
    }
    if (itens.length === 0) return setErro("Escolha pelo menos um item para entrar no estoque.");
    start(async () => {
      const r = await enviar(`${raiz}/confirmar`, { xml, data: String(form.get("data") ?? "") || null, itens });
      if (!r.ok) return setErro(r.erro);
      router.push("/estoque/entradas");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padded className="flex flex-col gap-3">
        <Field label="XML da NF-e" hint="(o arquivo .xml que o fornecedor manda)">
          <Input type="file" accept=".xml,text/xml,application/xml" onChange={escolherArquivo} />
        </Field>
        {pending && !nota && <p className="text-sm text-ink-muted">Lendo a nota…</p>}
        {erro && !nota && <FormMessage>{erro}</FormMessage>}
      </Card>

      {nota && (
        <form onSubmit={confirmar} className="flex flex-col gap-4">
          <Card padded className="grid gap-2 text-[15px] sm:grid-cols-2">
            <p>
              <span className="text-ink-muted">Fornecedor: </span>
              <span className="font-semibold text-ink">{nota.emitente.nome}</span>
              {!nota.fornecedor && <span className="text-ink-muted"> (novo, será cadastrado)</span>}
            </p>
            <p>
              <span className="text-ink-muted">Nota: </span>
              {nota.numero} série {nota.serie} · {dataBr(nota.emissao)}
            </p>
            <p>
              <span className="text-ink-muted">Destinatário: </span>
              {nota.destinatario.nome ?? "—"} {nota.destinatario.documento && `(${nota.destinatario.documento})`}
            </p>
            <p>
              <span className="text-ink-muted">Valor da nota: </span>
              {dinheiro(nota.valorTotal)}
            </p>
            <Field label="Data de entrada no estoque">
              <Input name="data" type="date" defaultValue={nota.emissao} />
            </Field>
          </Card>

          <Card className="overflow-x-auto">
            <table className={tabela.table}>
              <thead className={tabela.thead}>
                <tr>
                  <th className={tabela.th}>Entra</th>
                  <th className={tabela.th}>Item da nota</th>
                  <th className={tabela.th}>Produto</th>
                  <th className={tabela.th}>Fator</th>
                  <th className={tabela.th}>Local</th>
                  <th className={tabela.th}>Lote</th>
                </tr>
              </thead>
              <tbody>
                {nota.itens.map((item, i) => {
                  const s = nota.sugestoes[i];
                  return (
                    <tr key={i} className={tabela.linha}>
                      <td className={tabela.td}>
                        <input type="checkbox" name={`usar-${i}`} defaultChecked className="size-4" aria-label={`Importar ${item.descricao}`} />
                      </td>
                      <td className={tabela.td}>
                        <span className="block font-semibold text-ink">{item.descricao}</span>
                        <span className="block text-sm text-ink-muted">
                          {item.quantidade} {item.unidade} · {dinheiro(item.custoTotal)}
                        </span>
                      </td>
                      <td className={tabela.td}>
                        <Select name={`produto-${i}`} defaultValue={s?.produtoId ?? ""}>
                          <option value="">Escolha</option>
                          {ativos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className={tabela.td}>
                        <Input name={`fator-${i}`} inputMode="decimal" defaultValue={String(s?.fator ?? 1).replace(".", ",")} className="w-24" />
                      </td>
                      <td className={tabela.td}>
                        <Select name={`local-${i}`} defaultValue={s?.localId ?? ""}>
                          <option value="">Escolha</option>
                          {locaisAtivos.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nome}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className={cx(tabela.td, "text-sm")}>
                        {item.lotes.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {item.lotes.map((l, j) => (
                              <div key={j} className="flex flex-wrap gap-1">
                                <Input name={`lote-${i}-${j}`} defaultValue={l.lote} aria-label="Lote" className="w-24" />
                                <Input name={`qlote-${i}-${j}`} inputMode="decimal" defaultValue={String(l.quantidade).replace(".", ",")} aria-label="Quantidade do lote" className="w-20" />
                                <Input name={`val-${i}-${j}`} type="date" defaultValue={l.validade ?? ""} aria-label="Validade" className="w-36" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Input name={`lote-${i}`} placeholder="Lote (se exigir)" className="w-32" />
                            <Input name={`validade-${i}`} type="date" className="w-36" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="text-sm text-ink-muted">
            Fator = quanto da unidade de estoque vem em cada unidade da nota (ex.: saco de 25 kg → 25). Da próxima nota deste fornecedor, o produto, o fator e o local já vêm preenchidos.
          </p>

          {erro && <FormMessage>{erro}</FormMessage>}
          <div className="flex gap-2">
            <Button type="submit" variant="primario" loading={pending}>
              Confirmar entrada
            </Button>
            <Button
              variant="fantasma"
              onClick={() => {
                setNota(null);
                setXml(null);
              }}
            >
              Trocar o arquivo
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
