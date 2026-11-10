"use client";

import { novidadesSchema } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { proximaVerificacao, voltouDaOciosidade } from "@/lib/ao-vivo";

/**
 * Deixa a tela em dia sem recarregar. Pergunta à api se mudou alguma coisa —
 * ocorrência que chegou do gravador, aviso novo, alguém salvou ou descartou —
 * e, se mudou, pede a página de novo ao servidor (`router.refresh()`): o sino,
 * o contador do menu e as listas se atualizam sem perder o que está aberto
 * ou sendo digitado. Não desenha nada.
 *
 * `versao` é a do momento em que o servidor montou a tela; comparar com ela
 * evita perder o que chegou entre a montagem e a primeira pergunta.
 */
export function AoVivo({ orgId, versao }: { orgId: string; versao: string | null }) {
  const router = useRouter();
  const conhecida = useRef(versao);

  // Cada refresh traz a versão do que acabou de ser montado.
  useEffect(() => {
    conhecida.current = versao;
  }, [versao]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ocupado = false;
    let parado = false;
    let ultimaAtividade = Date.now();

    function agendar() {
      clearTimeout(timer);
      const ms = proximaVerificacao(document.visibilityState === "visible", Date.now() - ultimaAtividade);
      if (!parado && ms !== null) timer = setTimeout(verificar, ms);
    }

    async function verificar() {
      clearTimeout(timer);
      if (parado || ocupado || document.visibilityState !== "visible") return;
      ocupado = true;
      try {
        const res = await fetch(`/api/org/${encodeURIComponent(orgId)}/novidades`, { cache: "no-store" });
        const r = res.ok ? novidadesSchema.safeParse(await res.json()) : null;
        if (!parado && r?.success && r.data.versao !== conhecida.current) {
          conhecida.current = r.data.versao;
          router.refresh();
        }
      } catch {
        // Sem rede ou api fora do ar: tenta de novo na próxima.
      } finally {
        ocupado = false;
      }
      agendar();
    }

    // Voltou para a aba ou para a janela: pergunta na hora (escondida, para).
    const aoVoltar = () => void verificar();
    const atividade = () => {
      const estavaParada = voltouDaOciosidade(Date.now() - ultimaAtividade);
      ultimaAtividade = Date.now();
      if (estavaParada) void verificar();
    };

    const eventos = ["pointerdown", "pointermove", "keydown", "wheel"] as const;
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    for (const e of eventos) window.addEventListener(e, atividade, { passive: true });
    agendar();

    return () => {
      parado = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      for (const e of eventos) window.removeEventListener(e, atividade);
    };
  }, [orgId, router]);

  return null;
}
