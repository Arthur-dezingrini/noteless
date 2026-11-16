import { VERSAO_TERMOS } from "@vocare/shared";
import type { ReactNode } from "react";

/** "2026-11-16" → "16/11/2026". */
export const versaoPorExtenso = VERSAO_TERMOS.split("-").reverse().join("/");

/** Casca comum dos textos legais: título, versão e as seções. */
export function DocumentoLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-6 text-[15px] leading-relaxed text-ink-soft">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">{titulo}</h1>
        <p className="text-sm text-ink-muted">Versão de {versaoPorExtenso}</p>
      </header>
      {children}
    </article>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      {children}
    </section>
  );
}

export function Lista({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>;
}
