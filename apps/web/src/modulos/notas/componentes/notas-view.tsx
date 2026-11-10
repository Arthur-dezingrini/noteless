"use client";

import { type Ocorrencia, type StatusOcorrencia } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader, Tabs } from "@/components/ui";
import { BRAND_NAME } from "@/lib/brand";

import { type AnimalRef, type GrupoRef, type GalpaoRef, type LoteRef, type Cadastro } from "./tipos";
import { Detalhe } from "./detalhe";
import { ItemLista } from "./item-lista";

const ABAS: { status: StatusOcorrencia; label: string }[] = [
  { status: "pendente", label: "Para conferir" },
  { status: "confirmada", label: "Salvas" },
  { status: "descartada", label: "Descartadas" },
];

const VAZIO: Record<StatusOcorrencia, { titulo: string; texto: string }> = {
  pendente: {
    titulo: "Nada para conferir",
    texto: `Quando alguém falar no microfone do ${BRAND_NAME}, a nota aparece aqui para você conferir antes de entrar no sistema.`,
  },
  confirmada: { titulo: "Nada salvo ainda", texto: "As notas que você conferir e salvar ficam aqui." },
  descartada: { titulo: "Nenhuma nota descartada", texto: "O que for descartado fica aqui por 30 dias, caso mude de ideia." },
};

export function NotasView({
  orgId,
  ocorrencias: iniciais,
  animais: listaAnimais,
  grupos: listaGrupos,
  galpoes: listaGalpoes,
  lotes: listaLotes,
  podeSalvar,
  selecionarId,
}: {
  orgId: string;
  ocorrencias: Ocorrencia[];
  animais: AnimalRef[];
  grupos: GrupoRef[];
  galpoes: GalpaoRef[];
  lotes: LoteRef[];
  podeSalvar: boolean;
  /** Vindo de uma notificação: abre esta ocorrência, na aba certa. */
  selecionarId?: string;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [anteriores, setAnteriores] = useState(iniciais);
  const [aba, setAba] = useState<StatusOcorrencia>(() => iniciais.find((o) => o.id === selecionarId)?.status ?? "pendente");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(selecionarId ?? null);
  if (anteriores !== iniciais) {
    setAnteriores(iniciais);
    setLista(iniciais);
    // A lista nova pode trazer uma ocorrência que acabou de chegar, no topo.
    // Quem estava aberta (mesmo sem clique, por ser a primeira) continua aberta.
    if (!selecionadaId) {
      const aberta = lista.find((o) => o.status === aba);
      if (aberta) setSelecionadaId(aberta.id);
    }
  }
  const cad: Cadastro = {
    animais: new Map(listaAnimais.map((a) => [a.id, a])),
    grupos: new Map(listaGrupos.map((g) => [g.id, g])),
    galpoes: new Map(listaGalpoes.map((g) => [g.id, g])),
    lotes: new Map(listaLotes.map((l) => [l.id, l])),
  };

  function substituir(oc: Ocorrencia) {
    setLista((l) => l.map((x) => (x.id === oc.id ? oc : x)));
    setAba(oc.status);
    setSelecionadaId(oc.id);
    // Salvar cria consulta/anotação/peso: as outras telas (e o contador do menu) precisam ver.
    router.refresh();
  }

  const visiveis = lista.filter((o) => o.status === aba);
  const selecionada = visiveis.find((o) => o.id === selecionadaId) ?? visiveis[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notas"
        description={`O que foi falado no microfone do ${BRAND_NAME}. Nada entra no sistema antes de alguém conferir.`}
      />

      <Tabs
        label="Situação"
        value={aba}
        items={ABAS.map((t) => ({ value: t.status, label: t.label, count: lista.filter((o) => o.status === t.status).length }))}
        onChange={(status) => {
          setAba(status);
          setSelecionadaId(null);
        }}
      />

      {visiveis.length === 0 ? (
        <div className="flex max-w-xl flex-col gap-1.5 py-6">
          <p className="text-lg font-semibold text-ink">{VAZIO[aba].titulo}</p>
          <p className="text-[15px] leading-relaxed text-ink-soft">{VAZIO[aba].texto}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-7">
          <ul aria-label="Notas" className="flex max-w-[310px] min-w-0 flex-[1_1_15rem] flex-col gap-0.5">
            {visiveis.map((oc) => (
              <ItemLista key={oc.id} oc={oc} ativa={oc.id === selecionada?.id} onClick={() => setSelecionadaId(oc.id)} />
            ))}
          </ul>
          {selecionada && (
            <Detalhe
              key={`${selecionada.id}-${selecionada.status}-${selecionada.transcricao.length}`}
              oc={selecionada}
              orgId={orgId}
              cad={cad}
              podeSalvar={podeSalvar}
              onAtualizada={substituir}
            />
          )}
        </div>
      )}
    </div>
  );
}
