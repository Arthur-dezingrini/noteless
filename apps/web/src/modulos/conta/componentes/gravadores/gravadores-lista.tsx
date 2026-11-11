"use client";

import { sinalEmPalavras, type Empresa, type Gravador } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type KeyboardEvent } from "react";

import { Button, Card, cx, EmptyState, StatusText, tabela } from "@/components/ui";
import { haQuantoTempo } from "@/lib/datas";

import { GerenciarGravador } from "./gerenciar-gravador";
import { Destino, Situacao } from "./situacao";

/**
 * Configurações › Gravadores: o estado de cada placa de campo. Super usuário
 * vê todas e, clicando, renomeia, escolhe a empresa e esquece; o administrador
 * vê as que mandam para a empresa dele.
 */
export function GravadoresLista({
  gravadores,
  empresasPorConta,
  podeMexer,
}: {
  gravadores: Gravador[];
  /** Empresas a que a conta de cada placa está vinculada (id da conta → empresas). */
  empresasPorConta: Record<string, Empresa[]>;
  podeMexer: boolean;
}) {
  const router = useRouter();
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = gravadores.find((g) => g.id === abertoId) ?? null;

  // Sem atualizar sozinha: cada busca é uma requisição na Vercel e acorda o banco.
  const [atualizando, start] = useTransition();

  const teclas = (e: KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setAbertoId(id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          A placa avisa quando algo muda e, fora isso, a cada 15 min. Sem contato há mais de 20 min: desligada, sem Wi-Fi ou sem conseguir entrar.
        </p>
        <Button variant="pequeno" loading={atualizando} onClick={() => start(() => router.refresh())}>
          Atualizar
        </Button>
      </div>
      <Card className="overflow-hidden">
        {gravadores.length === 0 ? (
          <EmptyState
            title="Nenhum gravador ainda"
            description="O gravador aparece aqui sozinho na primeira vez que entra na internet com a conta dele."
          />
        ) : (
          <table className={tabela.table}>
            <thead className={tabela.thead}>
              <tr>
                <th className={tabela.th}>Gravador</th>
                <th className={cx(tabela.th, "w-52")}>Situação</th>
                <th className={cx(tabela.th, "hidden md:table-cell")}>Empresa</th>
                <th className={cx(tabela.th, "hidden lg:table-cell")}>Wi-Fi</th>
                <th className={cx(tabela.th, "hidden w-40 sm:table-cell")}>Fila</th>
                <th className={cx(tabela.th, "hidden w-44 lg:table-cell")}>Cartão</th>
                <th className={cx(tabela.th, "hidden xl:table-cell")}>Último erro</th>
              </tr>
            </thead>
            <tbody>
              {gravadores.map((g) => (
                <tr
                  key={g.id}
                  className={tabela.linhaClicavel}
                  tabIndex={0}
                  aria-label={`Ver ${g.nome}`}
                  onClick={() => setAbertoId(g.id)}
                  onKeyDown={(e) => teclas(e, g.id)}
                >
                  <td className={tabela.td}>
                    <span className="block truncate font-semibold text-ink">{g.nome}</span>
                    <span className="block truncate text-[13px] text-ink-muted">{g.serie}</span>
                  </td>
                  <td className={tabela.td}>
                    <Situacao g={g} />
                  </td>
                  <td className={cx(tabela.td, "hidden truncate md:table-cell")}>
                    <Destino g={g} />
                  </td>
                  <td className={cx(tabela.td, "hidden truncate lg:table-cell")}>
                    {g.estado.wifi.rede}
                    <span className={sinalEmPalavras(g.estado.wifi.sinalDbm) === "bom" ? "text-ink-muted" : "text-warn"}>
                      {" "}
                      · sinal {sinalEmPalavras(g.estado.wifi.sinalDbm)}
                    </span>
                  </td>
                  <td className={cx(tabela.td, "hidden sm:table-cell")}>
                    {g.estado.fila === 0 ? <span className="text-ink-muted">Tudo enviado</span> : `${g.estado.fila} esperando`}
                  </td>
                  <td className={cx(tabela.td, "hidden lg:table-cell")}>
                    {g.estado.cartao.ok ? (
                      <span className="text-ink-muted">
                        Ok{g.estado.cartao.livreGb !== null ? ` · ${g.estado.cartao.livreGb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB livres` : ""}
                      </span>
                    ) : (
                      <StatusText tone="perigo">Com problema</StatusText>
                    )}
                  </td>
                  <td className={cx(tabela.td, "hidden truncate text-ink-muted xl:table-cell")} suppressHydrationWarning>
                    {g.estado.ultimoErro ? `${haQuantoTempo(new Date(g.estado.ultimoErro.em))} · ${g.estado.ultimoErro.texto}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <GerenciarGravador
        gravador={aberto}
        empresas={aberto ? (empresasPorConta[aberto.conta.id] ?? []) : []}
        podeMexer={podeMexer}
        onClose={() => setAbertoId(null)}
      />
    </div>
  );
}
