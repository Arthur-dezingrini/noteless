"use client";

import {
  ROTULO_FASE_LOTE,
  ROTULO_SEXO,
  type DiaGalpao,
  type FichaLote,
  type Instalacao,
} from "@vocare/shared";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type ReactNode } from "react";

import { Button, Card, cx, EmptyState, PageHeader, StatusText, tabela, Tabs, tabId } from "@/components/ui";

import { EncerrarModal, FaseModal, PesagemModal, TransferirModal, VacinaModal } from "./acoes-lote";
import { ApontamentoModal } from "./apontamento-modal";

const ABAS = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "pesagens", label: "Pesagens" },
  { value: "vacinas", label: "Vacinas" },
] as const;
type Aba = (typeof ABAS)[number]["value"];

const PAINEL = "painel-lote";

/** "AAAA-MM-DD" → "DD/MM". */
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const num = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const pct = (v: number | null | undefined) => (v == null ? "—" : `${num(v)}%`);

type Acao = "transferir" | "fase" | "encerrar" | "pesagem" | "vacina";

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
                <Button variant="perigo" onClick={() => setAcao("encerrar")}>
                  Encerrar
                </Button>
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
    </div>
  );
}

function Diario({ ficha, editavel, onAbrir }: { ficha: FichaLote; editavel: boolean; onAbrir: (d: DiaGalpao) => void }) {
  if (ficha.diario.length === 0) {
    return <Card><EmptyState title="Nenhum apontamento ainda" description="Lance o primeiro dia para ver os indicadores." /></Card>;
  }
  const teclas = (e: KeyboardEvent, d: DiaGalpao) => {
    if (e.key === "Enter") onAbrir(d);
  };
  return (
    <Card className="overflow-x-auto">
      <table className={cx(tabela.table, "min-w-[720px]")}>
        <thead className={tabela.thead}>
          <tr>
            <th className={cx(tabela.th, "w-20")}>Data</th>
            <th className={tabela.th}>Galpão</th>
            <th className={tabela.th}>Mortas / elim.</th>
            <th className={tabela.th}>Ovos</th>
            <th className={tabela.th}>Postura</th>
            <th className={tabela.th}>Ração (kg)</th>
            <th className={tabela.th}>Origem</th>
          </tr>
        </thead>
        <tbody>
          {ficha.diario.map((d) => {
            const v = d.valores;
            const mortas = (v.mortasFemeas ?? 0) + (v.mortasMachos ?? 0);
            const elim = (v.eliminadasFemeas ?? 0) + (v.eliminadasMachos ?? 0);
            const props = editavel
              ? {
                  tabIndex: 0,
                  "aria-label": `Editar apontamento de ${dm(d.data)}, ${d.instalacaoNome}`,
                  onClick: () => onAbrir(d),
                  onKeyDown: (e: KeyboardEvent) => teclas(e, d),
                  className: tabela.linhaClicavel,
                }
              : { className: tabela.linha };
            return (
              <tr key={`${d.data}-${d.instalacaoId}`} {...props}>
                <td className={cx(tabela.td, "tabular-nums")}>{dm(d.data)}</td>
                <td className={cx(tabela.td, "truncate")}>{d.instalacaoNome}</td>
                <td className={cx(tabela.td, "tabular-nums")}>
                  {mortas} / {elim}
                  {d.indicadores.mortalidadeDiaPct != null && (
                    <span className="block text-sm text-ink-muted">{pct(d.indicadores.mortalidadeDiaPct)}</span>
                  )}
                </td>
                <td className={cx(tabela.td, "tabular-nums")}>{num(v.ovosTotal, 0)}</td>
                <td className={cx(tabela.td, "tabular-nums")}>{pct(d.indicadores.posturaPct)}</td>
                <td className={cx(tabela.td, "tabular-nums")}>{num(v.racaoKg)}</td>
                <td className={tabela.td}>
                  {d.ocorrenciaId ? (
                    <Link
                      href={`/ocorrencias?id=${encodeURIComponent(d.ocorrenciaId)}` as Route}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-ink underline underline-offset-[3px]"
                    >
                      da nota
                    </Link>
                  ) : (
                    <span className="text-ink-muted">manual</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Semanal({ ficha }: { ficha: FichaLote }) {
  if (ficha.semanal.length === 0) {
    return <Card><EmptyState title="Nenhuma semana ainda" description="O resumo semanal aparece depois do primeiro apontamento." /></Card>;
  }
  const cab = ["Sem.", "Período", "Mortas", "Elim.", "Mort. %", "Postura %", "Incub. %", "Ração g/ave", "Peso F (g)", "Peso M (g)", "Unif. F %", "Unif. M %"];
  return (
    <Card className="overflow-x-auto print:border-0">
      <h2 className="hidden px-[18px] pt-4 text-lg font-semibold text-ink print:block">Lote {ficha.lote.codigo}, resumo semanal</h2>
      <table className={cx(tabela.table, "min-w-[900px]")}>
        <thead className={tabela.thead}>
          <tr>
            {cab.map((c) => (
              <th key={c} className={tabela.th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ficha.semanal.map((s) => (
            <tr key={s.semana} className={cx(tabela.linha, "tabular-nums")}>
              <td className={tabela.td}>{s.semana}ª</td>
              <td className={tabela.td}>
                {dm(s.inicio)} a {dm(s.fim)}
              </td>
              <td className={tabela.td}>{s.mortas}</td>
              <td className={tabela.td}>{s.eliminadas}</td>
              <td className={tabela.td}>{num(s.mortalidadePct)}</td>
              <td className={tabela.td}>{num(s.posturaPct)}</td>
              <td className={tabela.td}>{num(s.incubaveisPct)}</td>
              <td className={tabela.td}>{num(s.racaoGAveDia)}</td>
              <td className={tabela.td}>{num(s.pesoFemeaG, 0)}</td>
              <td className={tabela.td}>{num(s.pesoMachoG, 0)}</td>
              <td className={tabela.td}>{num(s.uniformidadeFemeaPct)}</td>
              <td className={tabela.td}>{num(s.uniformidadeMachoPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-[18px] py-3 text-sm text-ink-muted print:hidden">Use Imprimir do navegador para guardar ou mandar este resumo.</p>
    </Card>
  );
}

function Pesagens({ ficha }: { ficha: FichaLote }) {
  if (ficha.pesagens.length === 0) {
    return <Card><EmptyState title="Nenhuma pesagem" description="Registre a primeira pesagem em Pesagem." /></Card>;
  }
  return (
    <Card className="overflow-x-auto">
      <table className={cx(tabela.table, "min-w-[560px]")}>
        <thead className={tabela.thead}>
          <tr>
            <th className={cx(tabela.th, "w-20")}>Data</th>
            <th className={tabela.th}>Sexo</th>
            <th className={tabela.th}>Peso médio (g)</th>
            <th className={tabela.th}>Uniformidade</th>
            <th className={tabela.th}>Aves pesadas</th>
          </tr>
        </thead>
        <tbody>
          {ficha.pesagens.map((p) => (
            <tr key={p.id} className={cx(tabela.linha, "tabular-nums")}>
              <td className={tabela.td}>{dm(p.data)}</td>
              <td className={tabela.td}>{ROTULO_SEXO[p.sexo]}</td>
              <td className={tabela.td}>{num(p.pesoMedioG, 0)}</td>
              <td className={tabela.td}>{pct(p.uniformidadePct)}</td>
              <td className={tabela.td}>{num(p.amostra, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Vacinas({ ficha }: { ficha: FichaLote }) {
  if (ficha.vacinacoes.length === 0) {
    return <Card><EmptyState title="Nenhuma vacina" description="Registre a primeira vacinação em Vacina." /></Card>;
  }
  return (
    <Card className="overflow-x-auto">
      <table className={cx(tabela.table, "min-w-[520px]")}>
        <thead className={tabela.thead}>
          <tr>
            <th className={cx(tabela.th, "w-20")}>Data</th>
            <th className={tabela.th}>Vacina</th>
            <th className={tabela.th}>Via</th>
            <th className={tabela.th}>Próxima dose</th>
          </tr>
        </thead>
        <tbody>
          {ficha.vacinacoes.map((v) => (
            <tr key={v.id} className={cx(tabela.linha, "tabular-nums")}>
              <td className={tabela.td}>{dm(v.data)}</td>
              <td className={cx(tabela.td, "truncate")}>{v.vacina}</td>
              <td className={tabela.td}>{v.via ?? "—"}</td>
              <td className={tabela.td}>{v.proximaData ? dm(v.proximaData) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
