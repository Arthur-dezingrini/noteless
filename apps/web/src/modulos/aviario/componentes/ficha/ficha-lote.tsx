"use client";

import { ROTULO_FASE_LOTE, type DiaGalpao, type FichaLote, type Instalacao } from "@vocare/shared";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button, Card, PageHeader, StatusText, Tabs, tabId } from "@/components/ui";

import { DesfazerModal, EncerrarModal, FaseModal, PesagemModal, TransferirModal, VacinaModal } from "../acoes";
import { ApontamentoModal } from "../apontamento-modal";
import { ABAS, PAINEL, dm, num, pct, type Aba } from "./comum";
import { Diario } from "./diario";
import { Pesagens } from "./pesagens";
import { Semanal } from "./semanal";
import { Vacinas } from "./vacinas";

export type Acao = "transferir" | "fase" | "encerrar" | "pesagem" | "vacina" | "desfazer-transferencia" | "reabrir";

export function FichaLote({
  orgId,
  ficha,
  instalacoes,
  hoje,
  possoGerenciar,
}: {
  orgId: string;
  ficha: FichaLote;
  instalacoes: Instalacao[];
  hoje: string;
  possoGerenciar: boolean;
}) {
  const router = useRouter();
  const { lote, indicadores: ind } = ficha;
  const ativo = lote.situacao === "ativo";
  // Alojamento já fechado num lote ativo = houve transferência que pode ser desfeita.
  const transferiu = ativo && ficha.alojamentos.some((a) => a.fim !== null);
  const [aba, setAba] = useState<Aba>("diario");
  const [acao, setAcao] = useState<Acao | null>(null);
  // `false` = lançamento novo; um dia = correção da linha clicada.
  const [apontando, setApontando] = useState<DiaGalpao | false | null>(null);

  const base = { orgId, loteId: lote.id };
  function concluir() {
    setAcao(null);
    setApontando(null);
    router.refresh();
  }

  const faixa: [string, ReactNode][] = [
    ["Vivas (F / M)", `${num(ind.vivas.femeas, 0)} / ${num(ind.vivas.machos, 0)}`],
    ["Mortalidade acumulada", pct(ind.mortalidadeAcumuladaPct)],
    ["Postura da semana", pct(ind.posturaSemanaPct)],
    ["Incubáveis por fêmea", num(ind.incubaveisPorFemea, 2)],
    ["Ração (g/ave/dia)", num(ind.racaoGAveDiaSemana)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/lotes" className="flex items-center gap-1.5 self-start text-[15px] font-semibold text-ink-soft no-underline hover:text-ink print:hidden">
        <ChevronLeft className="size-4" /> Lotes
      </Link>

      <div className="-mt-2">
        <PageHeader
          title={lote.codigo}
          description={
            <>
              {[lote.linhagem, ROTULO_FASE_LOTE[lote.fase], `${lote.semana}ª semana`].filter(Boolean).join(" · ")}
              {!ativo && (
                <>
                  {" · "}
                  <StatusText tone="neutro" size="herda">
                    Encerrado{lote.dataEncerramento ? ` em ${dm(lote.dataEncerramento)}` : ""}
                  </StatusText>
                </>
              )}
            </>
          }
          actions={
            possoGerenciar && ativo ? (
              <span className="flex flex-wrap gap-2 print:hidden">
                <Button variant="primario" onClick={() => setApontando(false)}>
                  Lançar apontamento
                </Button>
                <Button onClick={() => setAcao("pesagem")}>Pesagem</Button>
                <Button onClick={() => setAcao("vacina")}>Vacina</Button>
                <Button onClick={() => setAcao("transferir")}>Transferir</Button>
                <Button onClick={() => setAcao("fase")}>Mudar fase</Button>
                {transferiu && <Button onClick={() => setAcao("desfazer-transferencia")}>Desfazer transferência</Button>}
                <Button variant="perigo" onClick={() => setAcao("encerrar")}>
                  Encerrar
                </Button>
              </span>
            ) : possoGerenciar ? (
              <span className="print:hidden">
                <Button onClick={() => setAcao("reabrir")}>Reabrir lote</Button>
              </span>
            ) : undefined
          }
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {faixa.map(([rotulo, valor]) => (
          <Card key={rotulo} padded className="flex flex-col gap-1">
            <dt className="text-sm text-ink-muted">{rotulo}</dt>
            <dd className="text-xl font-semibold text-ink tabular-nums">{valor}</dd>
          </Card>
        ))}
      </dl>

      <Tabs items={ABAS} value={aba} onChange={setAba} label="Registros do lote" panelId={PAINEL} className="print:hidden" />

      <div id={PAINEL} role="tabpanel" aria-labelledby={tabId(PAINEL, aba)}>
        {aba === "diario" && <Diario ficha={ficha} editavel={possoGerenciar && ativo} onAbrir={setApontando} />}
        {aba === "semanal" && <Semanal ficha={ficha} />}
        {aba === "pesagens" && <Pesagens ficha={ficha} />}
        {aba === "vacinas" && <Vacinas ficha={ficha} />}
      </div>

      {apontando !== null && (
        <ApontamentoModal
          {...base}
          galpoes={lote.galpoes}
          dia={apontando || null}
          dataPadrao={hoje}
          onClose={() => setApontando(null)}
          onDone={concluir}
        />
      )}
      {acao === "transferir" && <TransferirModal {...base} ficha={ficha} instalacoes={instalacoes} onClose={() => setAcao(null)} onDone={concluir} />}
      {acao === "fase" && <FaseModal {...base} ficha={ficha} onClose={() => setAcao(null)} onDone={concluir} />}
      {acao === "encerrar" && <EncerrarModal {...base} onClose={() => setAcao(null)} onDone={concluir} />}
      {acao === "pesagem" && <PesagemModal {...base} ficha={ficha} onClose={() => setAcao(null)} onDone={concluir} />}
      {acao === "vacina" && <VacinaModal {...base} onClose={() => setAcao(null)} onDone={concluir} />}
      {(acao === "desfazer-transferencia" || acao === "reabrir") && (
        <DesfazerModal {...base} rota={acao} onClose={() => setAcao(null)} onDone={concluir} />
      )}
    </div>
  );
}
