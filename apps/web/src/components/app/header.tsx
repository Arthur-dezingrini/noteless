"use client";

import type { Notificacao } from "@vocare/shared";
import { Bell } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { chamarApi } from "@/lib/api-client";
import { haQuantoTempo } from "@/lib/datas";
import { acharAtivo } from "@/lib/navigation";

/**
 * Topo da área logada: onde a pessoa está ("Animais › Grupos") e o sino. O painel lista os avisos; cada um leva ao
 * lugar certo e fica lido. Esc ou clique fora fecha.
 */
export function Header({ orgId, notificacoes }: { orgId: string | null; notificacoes: Notificacao[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState(notificacoes);
  const caixa = useRef<HTMLDivElement>(null);
  const naoLidas = lista.filter((n) => !n.lida).length;

  // O servidor manda a lista nova a cada navegação; o painel acompanha.
  const [anterior, setAnterior] = useState(notificacoes);
  if (anterior !== notificacoes) {
    setAnterior(notificacoes);
    setLista(notificacoes);
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function abrir(n: Notificacao) {
    setAberto(false);
    if (!n.lida && orgId) {
      setLista((l) => l.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      void chamarApi(`/api/org/${orgId}/notificacoes/${n.id}/lida`, { method: "POST" });
    }
    if (n.link) router.push(n.link as Route);
  }

  function lerTodas() {
    if (!orgId) return;
    setLista((l) => l.map((x) => ({ ...x, lida: true })));
    void chamarApi(`/api/org/${orgId}/notificacoes/lidas`, { method: "POST" });
  }

  return (
    <header className="print:hidden relative flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-6">
      <Caminho />
      <div ref={caixa}>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={naoLidas ? `Notificações, ${naoLidas} novas` : "Notificações"}
          aria-expanded={aberto}
          className={`relative grid size-10 cursor-pointer place-items-center rounded-field text-ink hover:bg-surface ${aberto ? "bg-surface" : ""}`}
        >
          <Bell className="size-5" />
          {naoLidas > 0 && (
            <span className="absolute top-1 right-[3px] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-notify px-1 text-[11px] font-bold text-white ring-2 ring-page">
              {naoLidas}
            </span>
          )}
        </button>

        {aberto && (
          <div
            role="dialog"
            aria-label="Notificações"
            className="absolute top-[52px] right-5 z-30 flex max-h-[540px] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-auto rounded-card border border-line bg-white shadow-[0_24px_48px_-24px_rgba(0,0,0,.3)]"
          >
            <div className="flex items-baseline justify-between gap-3 px-[18px] pt-4 pb-2.5">
              <span className="text-base font-semibold text-ink">Notificações</span>
              {naoLidas > 0 && (
                <button type="button" onClick={lerTodas} className="cursor-pointer text-sm font-semibold text-brand-ink">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            {lista.length === 0 ? (
              <p className="border-t border-line-soft px-[18px] py-6 text-[15px] text-ink-muted">
                Nenhum aviso. Quando alguém gravar ou salvar uma nota, aparece aqui.
              </p>
            ) : (
              lista.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => abrir(n)}
                  className={`flex cursor-pointer items-start gap-3 border-t border-line-soft px-[18px] py-3 text-left hover:bg-[#f7f5f0] ${
                    n.lida ? "" : "bg-[#fbf8f0]"
                  }`}
                >
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.lida ? "" : "bg-notify"}`} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-[15px] leading-snug text-ink ${n.lida ? "font-medium" : "font-semibold"}`}>
                      {n.texto}
                      {!n.lida && <span className="sr-only"> (não lida)</span>}
                    </span>
                    {n.detalhe && <span className="truncate text-sm text-ink-muted">{n.detalhe}</span>}
                  </span>
                  <span className="shrink-0 text-[13px] text-ink-muted" suppressHydrationWarning>
                    {haQuantoTempo(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/** "Módulo › Tela" do endereço atual; fora do menu (perfil), nada. */
function Caminho() {
  const ativo = acharAtivo(usePathname(), useSearchParams().get("tela"));
  if (!ativo) return <span />;
  return (
    <p className="truncate text-[15px] text-ink-muted">
      {ativo.tela ? (
        <>
          {ativo.modulo.rotulo} › <span className="font-semibold text-ink">{ativo.tela.rotulo}</span>
        </>
      ) : (
        <span className="font-semibold text-ink">{ativo.modulo.rotulo}</span>
      )}
    </p>
  );
}
