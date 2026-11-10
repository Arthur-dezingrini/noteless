"use client";

import {
  PERIODOS,
  RELATORIO_COM_PERIODO,
  ROTULO_PERIODO,
  ROTULO_RELATORIO,
  TIPOS_RELATORIO,
  type Periodo,
  type Relatorio,
  type TipoRelatorio,
} from "@vocare/shared";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { Button, buttonClass, cx, Card, PageHeader, Select, Tabs, tabela } from "@/components/ui";

/** "AAAA-MM-DD" → "DD/MM". */
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function situacaoVacina(dias: number): { texto: string; cor: string } {
  if (dias < 0) return { texto: `Venceu há ${-dias} ${dias === -1 ? "dia" : "dias"}`, cor: "text-danger" };
  if (dias === 0) return { texto: "Vence hoje", cor: "text-warn" };
  if (dias === 1) return { texto: "Vence amanhã", cor: "text-warn" };
  return { texto: `Em ${dias} dias`, cor: "text-ink-soft" };
}

/** Linhas do relatório como planilha (CSV com ; — abre certo no Excel em português). */
function paraCsv(r: Relatorio): string {
  const tab: (string | number)[][] = (() => {
    switch (r.tipo) {
      case "vacinas":
        return [["Data", "Animal ou grupo", "Vacina", "Doses", "Aplicada por", "Registrada"], ...r.linhas.map((l) => [l.data, l.alvo, l.vacina, l.doses, l.por ?? "", l.porAudio ? "Por áudio" : "Manual"])];
      case "vencer":
        return [["Animal", "Vacina", "Vence em", "Situação"], ...r.linhas.map((l) => [l.alvo, l.vacina, l.vence, situacaoVacina(l.dias).texto])];
      case "peso":
        return [["Mês", "Peso (kg)"], ...r.linhas.map((l) => [l.mes, String(l.pesoKg).replace(".", ",")])];
      case "tratamento":
        return [["Animal", "Desde", "Remédio", "Até", "Próximo"], ...r.linhas.map((l) => [l.alvo, l.desde, l.remedio, l.ate ?? "", l.proximo ?? ""])];
      case "ocorrencias":
        return [["Quem gravou", "Gravadas", "Salvas", "Descartadas"], ...r.linhas.map((l) => [l.nome, l.gravadas, l.salvas, l.descartadas])];
    }
  })();
  const celula = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + tab.map((linha) => linha.map(celula).join(";")).join("\r\n");
}

function Tabela({ cabecalho, children, largura = "" }: { cabecalho: ReactNode; children: ReactNode; largura?: string }) {
  return (
    <Card className={cx("overflow-x-auto", largura)}>
      <table className="w-full min-w-[36rem] text-left text-[15px]">
        <thead className={tabela.thead}>{cabecalho}</thead>
        <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-line-soft">{children}</tbody>
      </table>
    </Card>
  );
}

const th = "px-[18px] py-3 font-semibold";
const td = "px-[18px] py-3";

export function RelatoriosView({ tipo, periodo, relatorio: r }: { tipo: TipoRelatorio; periodo: Periodo; relatorio: Relatorio | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  function ir(m: { tipo?: TipoRelatorio; periodo?: Periodo; animal?: string }) {
    const q = new URLSearchParams({ tipo: m.tipo ?? tipo, periodo: m.periodo ?? periodo });
    if (m.animal) q.set("animal", m.animal);
    start(() => router.push(`${pathname}?${q}` as Route, { scroll: false }));
  }

  function baixar() {
    if (!r) return;
    const url = URL.createObjectURL(new Blob([paraCsv(r)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ROTULO_RELATORIO[tipo].toLowerCase().replace(/ /g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const vazio = r && r.linhas.length === 0;

  return (
    <div className={cx("flex flex-col gap-6 transition-opacity", pending && "opacity-60")}>
      <PageHeader
        title="Relatórios"
        description={
          <>
            <span className="print:hidden">Para imprimir, guardar ou mandar para alguém.</span>
            <span className="hidden print:inline">{ROTULO_RELATORIO[tipo]}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select
              value={periodo}
              onChange={(e) => ir({ periodo: e.target.value as Periodo })}
              aria-label="Período"
              disabled={!RELATORIO_COM_PERIODO.includes(tipo)}
              title={RELATORIO_COM_PERIODO.includes(tipo) ? undefined : "Este relatório não depende do período"}
              className="w-44"
            >
              {PERIODOS.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PERIODO[p]}
                </option>
              ))}
            </Select>
            <Button onClick={() => window.print()} disabled={!r || !!vazio}>
              Imprimir
            </Button>
            <Button onClick={baixar} disabled={!r || !!vazio}>
              Baixar planilha
            </Button>
          </div>
        }
      />

      <Tabs
        label="Relatório"
        items={TIPOS_RELATORIO.map((t) => ({
          value: t,
          label: ROTULO_RELATORIO[t],
        }))}
        value={tipo}
        onChange={(t) => ir({ tipo: t })}
        className="print:hidden"
      />

      {!r ? (
        <p className="text-[15px] text-danger">Não foi possível carregar o relatório. Recarregue a página.</p>
      ) : (
        <>
          <p className="-mt-1 text-base text-ink-soft">{r.resumo}</p>

          {r.tipo === "vacinas" && r.linhas.length > 0 && (
            <Tabela
              cabecalho={
                <tr>
                  <th className={`${th} w-20`}>Data</th>
                  <th className={th}>Animal ou grupo</th>
                  <th className={th}>Vacina</th>
                  <th className={th}>Aplicada por</th>
                  <th className={`${th} w-32`}>Registrada</th>
                </tr>
              }
            >
              {r.linhas.map((l, i) => (
                <tr key={i}>
                  <td className={`${td} text-ink-muted tabular-nums`}>{dm(l.data)}</td>
                  <td className={`${td} font-semibold`}>
                    {l.animalId ? (
                      <Link href={`/animais/${l.animalId}`} className="text-ink no-underline hover:underline">
                        {l.alvo}
                      </Link>
                    ) : (
                      l.alvo
                    )}
                  </td>
                  <td className={td}>{l.vacina}</td>
                  <td className={`${td} text-ink-soft`}>{l.por ?? "—"}</td>
                  <td className={`${td} text-ink-soft`}>{l.porAudio ? "Por áudio" : "Manual"}</td>
                </tr>
              ))}
            </Tabela>
          )}

          {r.tipo === "vencer" && r.linhas.length > 0 && (
            <Tabela
              cabecalho={
                <tr>
                  <th className={th}>Animal</th>
                  <th className={th}>Vacina</th>
                  <th className={`${th} w-24`}>Vence em</th>
                  <th className={th}>Situação</th>
                  <th className={`${th} w-44 print:hidden`}>
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              }
            >
              {r.linhas.map((l) => {
                const s = situacaoVacina(l.dias);
                return (
                  <tr key={`${l.animalId}-${l.vacina}`}>
                    <td className={`${td} font-semibold`}>
                      <Link href={`/animais/${l.animalId}`} className="text-ink no-underline hover:underline">
                        {l.alvo}
                      </Link>
                    </td>
                    <td className={td}>{l.vacina}</td>
                    <td className={`${td} text-ink-soft tabular-nums`}>{dm(l.vence)}</td>
                    <td className={`${td} text-sm font-semibold ${s.cor}`}>{s.texto}</td>
                    <td className="px-[18px] py-2.5 text-right print:hidden">
                      <Link
                        href={`/agenda?nova=${l.animalId}&tipo=vacinacao&obs=${encodeURIComponent(`Vacina ${l.vacina}`)}`}
                        className={buttonClass("pequeno")}
                      >
                        Marcar na agenda
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          )}

          {r.tipo === "peso" && (
            <>
              {r.animais.length > 0 && (
                <label className="flex items-center gap-2.5 print:hidden">
                  <span className="text-sm font-semibold text-ink-soft">Animal</span>
                  <Select value={r.animalId ?? ""} onChange={(e) => ir({ animal: e.target.value })} className="w-64">
                    {r.animais.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.rotulo}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              {r.linhas.length > 0 && (
                <Card className="flex max-w-[780px] flex-col gap-3 px-[22px] py-5">
                  {(() => {
                    const max = Math.max(...r.linhas.map((l) => l.pesoKg));
                    const min = Math.min(...r.linhas.map((l) => l.pesoKg));
                    // Barras a partir de 80% do menor peso: a diferença entre meses fica visível.
                    const base = min * 0.8;
                    return r.linhas.map((l, i) => (
                      <div key={l.mes} className="grid grid-cols-[44px_minmax(0,1fr)_84px] items-center gap-3.5">
                        <span className="text-sm text-ink-muted">{l.rotulo}</span>
                        <span className="flex h-[22px] overflow-hidden rounded-md bg-[#f4f2ed]">
                          <span
                            className={`h-full rounded-md ${i === r.linhas.length - 1 ? "bg-brand" : "bg-[#a9cdb4]"}`}
                            style={{
                              width: `${max === base ? 100 : Math.max(8, ((l.pesoKg - base) / (max - base)) * 100)}%`,
                            }}
                          />
                        </span>
                        <span className="text-right text-[15px] font-semibold text-ink tabular-nums">{l.pesoKg.toLocaleString("pt-BR")} kg</span>
                      </div>
                    ));
                  })()}
                </Card>
              )}
            </>
          )}

          {r.tipo === "tratamento" && r.linhas.length > 0 && (
            <Card as="ul">
              {r.linhas.map((l, i) => (
                <li key={`${l.animalId}-${i}`} className={cx("flex flex-wrap gap-x-7 gap-y-2 px-5 py-4", i > 0 && "border-t border-line")}>
                  <Link href={`/animais/${l.animalId}`} className="flex flex-[1_1_15rem] flex-col gap-0.5 text-ink no-underline hover:underline">
                    <span className="text-[15px] font-semibold">{l.alvo}</span>
                  </Link>
                  <div className="flex flex-[1_1_16rem] flex-col gap-0.5 text-sm">
                    <span className="text-ink-muted">Desde {l.desde}</span>
                    <span className="text-ink">
                      {l.remedio}
                      {l.ate && ` até ${l.ate}`}
                    </span>
                  </div>
                  <div className="flex-[0_1_14rem] text-sm font-semibold text-ink-soft">{l.proximo ?? "Nada marcado"}</div>
                </li>
              ))}
            </Card>
          )}

          {r.tipo === "ocorrencias" && r.linhas.length > 0 && (
            <Tabela
              largura="max-w-[780px]"
              cabecalho={
                <tr>
                  <th className={th}>Quem gravou</th>
                  <th className={`${th} text-right`}>Gravadas</th>
                  <th className={`${th} text-right`}>Salvas</th>
                  <th className={`${th} text-right`}>Descartadas</th>
                </tr>
              }
            >
              {r.linhas.map((l) => (
                <tr key={l.nome} className="tabular-nums">
                  <td className={`${td} font-semibold`}>{l.nome}</td>
                  <td className={`${td} text-right`}>{l.gravadas}</td>
                  <td className={`${td} text-right`}>{l.salvas}</td>
                  <td className={`${td} text-right text-ink-muted`}>{l.descartadas}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </>
      )}
    </div>
  );
}
