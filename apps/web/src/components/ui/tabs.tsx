import type { ReactNode } from "react";

import { cx } from "./variants";

export type TabItem<T extends string> = { value: T; label: ReactNode; count?: number | null };

/** Id da aba ligada ao painel `panelId` — use no aria-labelledby do painel. */
export function tabId(panelId: string, value: string): string {
  return `${panelId}-aba-${value}`;
}

/**
 * Abas sublinhadas. Controladas: quem usa guarda o estado e troca o conteúdo.
 * Com `panelId`, cada aba ganha id e aria-controls; o painel leva
 * `id={panelId} role="tabpanel" aria-labelledby={tabId(panelId, valor)}`.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  panelId,
  className,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Nome acessível da lista de abas. */
  label: string;
  panelId?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cx("flex flex-wrap gap-x-6 gap-y-1.5 border-b border-line", className)}>
      {items.map((t) => {
        const ativo = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={panelId && tabId(panelId, t.value)}
            aria-controls={panelId}
            aria-selected={ativo}
            onClick={() => onChange(t.value)}
            className={cx(
              "-mb-px flex cursor-pointer gap-1.5 border-b-2 pb-[11px] text-[15px] transition",
              ativo ? "border-ink font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count != null && <span className="font-medium text-ink-muted tabular-nums">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Alternância de poucas opções lado a lado (Dia | Semana). */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-field bg-surface p-[3px]">
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          aria-pressed={t.value === value}
          onClick={() => onChange(t.value)}
          className={cx(
            "cursor-pointer rounded-lg px-3.5 py-[7px] text-sm font-semibold transition",
            t.value === value ? "bg-white text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
