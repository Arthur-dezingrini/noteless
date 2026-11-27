"use client";

import {
  CATEGORIAS_PRODUTO,
  ROTULO_CATEGORIA_PRODUTO,
  ROTULO_TIPO_LOCAL,
  TIPOS_LOCAL,
  UNIDADES_ESTOQUE,
  type Fornecedor,
  type Local,
  type Produto,
} from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button, buttonClass, Card, cx, tabela } from "@/components/ui";

import { dinheiro, enviar, qtd } from "./comum";
import { FormModal, type Campo, type Valor } from "./form-modal";

/** Lista com botão "Cadastrar", tabela e o modal de cadastro/edição. */
function Cadastro<T extends { id: string }>({
  vazio,
  rotuloNovo,
  itens,
  cabecalho,
  linha,
  modal,
}: {
  vazio: string;
  rotuloNovo: string;
  itens: T[];
  cabecalho: ReactNode;
  linha: (item: T) => ReactNode;
  modal: (item: T | null, fechar: () => void, pronto: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<T | null | "novo">(null);
  const fechar = () => setAberto(null);
  const pronto = () => {
    setAberto(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primario" onClick={() => setAberto("novo")}>
          {rotuloNovo}
        </Button>
      </div>
      {itens.length === 0 ? (
        <Card padded className="text-sm text-ink-muted">
          {vazio}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                {cabecalho}
                <th className="w-20 px-3 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id} className={tabela.linha}>
                  {linha(i)}
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => setAberto(i)} className={buttonClass("linha")}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {aberto !== null && modal(aberto === "novo" ? null : aberto, fechar, pronto)}
    </div>
  );
}

const salvarEm = (caminho: string, metodo: string, corpo: Record<string, Valor>) => enviar(caminho, corpo, metodo).then((r) => (r.ok ? null : r.erro));
const inativo = (ativo: boolean) => (ativo ? null : <span className="block text-sm text-ink-muted">Inativo</span>);

export function ProdutosLista({ orgId, produtos }: { orgId: string; produtos: Produto[] }) {
  const campos = (p: Produto | null): Campo[] => [
    { nome: "nome", rotulo: "Nome", tipo: "texto", padrao: p?.nome, obrigatorio: true },
    {
      nome: "categoria",
      rotulo: "Categoria",
      tipo: "opcoes",
      padrao: p?.categoria ?? "racao",
      opcoes: CATEGORIAS_PRODUTO.map((c) => ({ valor: c, rotulo: ROTULO_CATEGORIA_PRODUTO[c] })),
    },
    { nome: "unidade", rotulo: "Unidade de estoque", tipo: "opcoes", padrao: p?.unidade ?? "kg", opcoes: UNIDADES_ESTOQUE.map((u) => ({ valor: u, rotulo: u })) },
    { nome: "embalagemNome", rotulo: "Embalagem de compra", tipo: "texto", padrao: p?.embalagemNome, dica: "(opcional, ex.: saco)" },
    { nome: "embalagemFator", rotulo: "Quanto vem na embalagem", tipo: "numero", padrao: p?.embalagemFator, dica: "(na unidade de estoque, ex.: 25)" },
    { nome: "estoqueMinimo", rotulo: "Estoque mínimo", tipo: "numero", padrao: p?.estoqueMinimo, dica: "(opcional; abaixo disso, aviso)" },
    ...(p ? [{ nome: "controlaLote", rotulo: "Exige lote de fabricação e validade", tipo: "marcar", padrao: p.controlaLote } as Campo] : []),
    ...(p ? [{ nome: "ativo", rotulo: "Ativo", tipo: "marcar", padrao: p.ativo } as Campo] : []),
  ];
  const raiz = `/api/org/${orgId}/estoque/produtos`;
  return (
    <Cadastro
      vazio="Nenhum produto cadastrado ainda. Cadastre a ração, as vacinas e os medicamentos que a granja compra."
      rotuloNovo="Cadastrar produto"
      itens={produtos}
      cabecalho={
        <>
          <th className={tabela.th}>Produto</th>
          <th className={cx(tabela.th, "hidden md:table-cell")}>Categoria</th>
          <th className={cx(tabela.th, "hidden md:table-cell")}>Embalagem</th>
          <th className={cx(tabela.th, "hidden lg:table-cell")}>Mínimo</th>
          <th className={tabela.th}>Custo médio</th>
        </>
      }
      linha={(p) => (
        <>
          <td className={tabela.td}>
            <span className="block font-semibold text-ink">{p.nome}</span>
            {inativo(p.ativo)}
          </td>
          <td className={cx(tabela.td, "hidden md:table-cell")}>{ROTULO_CATEGORIA_PRODUTO[p.categoria]}</td>
          <td className={cx(tabela.td, "hidden md:table-cell")}>
            {p.embalagemNome && p.embalagemFator ? `${p.embalagemNome} de ${qtd(p.embalagemFator, p.unidade)}` : p.unidade}
          </td>
          <td className={cx(tabela.td, "hidden tabular-nums lg:table-cell")}>{p.estoqueMinimo == null ? "—" : qtd(p.estoqueMinimo, p.unidade)}</td>
          <td className={cx(tabela.td, "tabular-nums")}>{p.custoMedio ? `${dinheiro(p.custoMedio)}/${p.unidade}` : "—"}</td>
        </>
      )}
      modal={(p, fechar, pronto) => (
        <FormModal
          titulo={p ? "Editar produto" : "Cadastrar produto"}
          campos={campos(p)}
          confirmar="Salvar"
          salvar={(v) => (p ? salvarEm(`${raiz}/${p.id}`, "PATCH", v) : salvarEm(raiz, "POST", v))}
          onClose={fechar}
          onDone={pronto}
        />
      )}
    />
  );
}

export function LocaisLista({ orgId, locais, galpoes }: { orgId: string; locais: Local[]; galpoes: { id: string; nome: string }[] }) {
  const campos = (l: Local | null): Campo[] => [
    { nome: "nome", rotulo: "Nome", tipo: "texto", padrao: l?.nome, obrigatorio: true },
    { nome: "tipo", rotulo: "Tipo", tipo: "opcoes", padrao: l?.tipo ?? "deposito", opcoes: TIPOS_LOCAL.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_LOCAL[t] })) },
    {
      nome: "instalacaoId",
      rotulo: "Galpão",
      tipo: "opcoes",
      padrao: l?.instalacaoId,
      vazio: "Nenhum",
      dica: "(silo: a ração do registro diário do galpão sai daqui)",
      opcoes: galpoes.map((g) => ({ valor: g.id, rotulo: g.nome })),
    },
    ...(l ? [{ nome: "ativo", rotulo: "Ativo", tipo: "marcar", padrao: l.ativo } as Campo] : []),
  ];
  const raiz = `/api/org/${orgId}/estoque/locais`;
  return (
    <Cadastro
      vazio="Nenhum local cadastrado ainda. Cadastre o depósito, a geladeira de vacinas e o silo de cada galpão."
      rotuloNovo="Cadastrar local"
      itens={locais}
      cabecalho={
        <>
          <th className={tabela.th}>Local</th>
          <th className={tabela.th}>Tipo</th>
          <th className={cx(tabela.th, "hidden md:table-cell")}>Galpão</th>
        </>
      }
      linha={(l) => (
        <>
          <td className={tabela.td}>
            <span className="block font-semibold text-ink">{l.nome}</span>
            {inativo(l.ativo)}
          </td>
          <td className={tabela.td}>{ROTULO_TIPO_LOCAL[l.tipo]}</td>
          <td className={cx(tabela.td, "hidden md:table-cell")}>{l.instalacaoNome ?? "—"}</td>
        </>
      )}
      modal={(l, fechar, pronto) => (
        <FormModal
          titulo={l ? "Editar local" : "Cadastrar local"}
          campos={campos(l)}
          confirmar="Salvar"
          salvar={(v) => (l ? salvarEm(`${raiz}/${l.id}`, "PATCH", v) : salvarEm(raiz, "POST", v))}
          onClose={fechar}
          onDone={pronto}
        />
      )}
    />
  );
}

export function FornecedoresLista({ orgId, fornecedores }: { orgId: string; fornecedores: Fornecedor[] }) {
  const campos = (f: Fornecedor | null): Campo[] => [
    { nome: "nome", rotulo: "Nome", tipo: "texto", padrao: f?.nome, obrigatorio: true },
    { nome: "documento", rotulo: "CNPJ ou CPF", tipo: "texto", padrao: f?.documento, dica: "(opcional)" },
    { nome: "telefone", rotulo: "Telefone", tipo: "texto", padrao: f?.telefone, dica: "(opcional)" },
  ];
  const raiz = `/api/org/${orgId}/estoque/fornecedores`;
  return (
    <Cadastro
      vazio="Nenhum fornecedor cadastrado ainda."
      rotuloNovo="Cadastrar fornecedor"
      itens={fornecedores}
      cabecalho={
        <>
          <th className={tabela.th}>Fornecedor</th>
          <th className={cx(tabela.th, "hidden md:table-cell")}>Documento</th>
          <th className={cx(tabela.th, "hidden md:table-cell")}>Telefone</th>
        </>
      }
      linha={(f) => (
        <>
          <td className={cx(tabela.td, "font-semibold text-ink")}>{f.nome}</td>
          <td className={cx(tabela.td, "hidden tabular-nums md:table-cell")}>{f.documento ?? "—"}</td>
          <td className={cx(tabela.td, "hidden md:table-cell")}>{f.telefone ?? "—"}</td>
        </>
      )}
      modal={(f, fechar, pronto) => (
        <FormModal
          titulo={f ? "Editar fornecedor" : "Cadastrar fornecedor"}
          campos={campos(f)}
          confirmar="Salvar"
          salvar={(v) => (f ? salvarEm(`${raiz}/${f.id}`, "PATCH", v) : salvarEm(raiz, "POST", v))}
          onClose={fechar}
          onDone={pronto}
        />
      )}
    />
  );
}
