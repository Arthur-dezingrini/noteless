"use client";

import type { Local, SaldoProduto } from "@vocare/shared";

import { hojeISO } from "@/lib/datas";

import { enviar, qtd } from "./comum";
import { FormModal } from "./form-modal";

type Base = { orgId: string; onClose: () => void; onDone: () => void };

const opcoesLocais = (locais: Local[]) => locais.filter((l) => l.ativo).map((l) => ({ valor: l.id, rotulo: l.nome }));

/** Saída manual; acima do saldo, pergunta antes de deixar o saldo negativo. */
export function SaidaModal({ orgId, saldo, locais, onClose, onDone }: Base & { saldo: SaldoProduto; locais: Local[] }) {
  const { produto } = saldo;
  return (
    <FormModal
      titulo={`Saída de ${produto.nome}`}
      subtitulo={`Saldo total: ${qtd(saldo.total, produto.unidade)}`}
      confirmar="Lançar saída"
      campos={[
        { nome: "localId", rotulo: "Local", tipo: "opcoes", padrao: saldo.porLocal[0]?.localId, opcoes: opcoesLocais(locais) },
        { nome: "quantidade", rotulo: `Quantidade (${produto.unidade})`, tipo: "numero", obrigatorio: true },
        { nome: "data", rotulo: "Data", tipo: "data", padrao: hojeISO(), obrigatorio: true },
        ...(produto.controlaLote ? [{ nome: "loteFabricacao", rotulo: "Lote de fabricação", tipo: "texto" as const, dica: "(vazio: sai o que vence primeiro)" }] : []),
        { nome: "motivo", rotulo: "Motivo", tipo: "texto", dica: "(opcional)" },
      ]}
      salvar={async (v) => {
        const caminho = `/api/org/${orgId}/estoque/movimentos/saida`;
        const corpo = { ...v, produtoId: produto.id };
        const r = await enviar(caminho, corpo);
        if (r.ok) return null;
        if (r.status === 409 && r.saldo !== undefined) {
          const seguir = window.confirm(`O saldo neste local é ${qtd(r.saldo, produto.unidade)}. Lançar mesmo assim? O saldo vai ficar negativo.`);
          if (!seguir) return "Saída não lançada.";
          const de = await enviar(caminho, { ...corpo, confirmarNegativo: true });
          return de.ok ? null : de.erro;
        }
        return r.erro;
      }}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

export function TransferenciaModal({ orgId, saldo, locais, onClose, onDone }: Base & { saldo: SaldoProduto; locais: Local[] }) {
  const { produto } = saldo;
  return (
    <FormModal
      titulo={`Transferir ${produto.nome}`}
      subtitulo={saldo.porLocal.map((l) => `${l.localNome}: ${qtd(l.quantidade, produto.unidade)}`).join(" · ") || undefined}
      confirmar="Transferir"
      campos={[
        { nome: "deLocalId", rotulo: "De", tipo: "opcoes", padrao: saldo.porLocal[0]?.localId, opcoes: opcoesLocais(locais) },
        { nome: "paraLocalId", rotulo: "Para", tipo: "opcoes", vazio: "Escolha", opcoes: opcoesLocais(locais) },
        { nome: "quantidade", rotulo: `Quantidade (${produto.unidade})`, tipo: "numero", obrigatorio: true },
        { nome: "data", rotulo: "Data", tipo: "data", padrao: hojeISO(), obrigatorio: true },
      ]}
      salvar={async (v) => {
        if (!v.paraLocalId) return "Escolha o local de destino.";
        const r = await enviar(`/api/org/${orgId}/estoque/movimentos/transferencia`, { ...v, produtoId: produto.id });
        return r.ok ? null : r.erro;
      }}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

/** Estorno de um movimento do livro ou de uma entrada inteira. */
export function EstornoModal({ caminho, descricao, onClose, onDone }: { caminho: string; descricao: string; onClose: () => void; onDone: () => void }) {
  return (
    <FormModal
      titulo="Estornar"
      subtitulo={descricao}
      confirmar="Estornar"
      campos={[{ nome: "motivo", rotulo: "Motivo", tipo: "texto", obrigatorio: true }]}
      salvar={async (v) => {
        const r = await enviar(caminho, v);
        return r.ok ? null : r.erro;
      }}
      onClose={onClose}
      onDone={onDone}
    />
  );
}
