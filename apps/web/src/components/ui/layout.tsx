import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./variants";

/** Topo de toda página: título, descrição e as ações à direita. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Linha pequena acima do título (ex.: a data no Início). */
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow && <p className="text-[15px] text-ink-muted">{eyebrow}</p>}
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="text-base text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Título de seção (h2) com ação opcional à direita, ex.: "Hoje · Ver agenda". */
export function SectionHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}

/**
 * Cartão branco com borda. `padded` para conteúdo solto; sem ele, para listas
 * e tabelas. Repassa atributos HTML (aria-label, id…).
 */
export function Card({
  padded = false,
  as: Tag = "div",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  padded?: boolean;
  as?: "div" | "section" | "ul" | "ol" | "p";
}) {
  return (
    <Tag className={cx("rounded-card border border-line bg-white", padded && "p-6", className)} {...props}>
      {children}
    </Tag>
  );
}

/** Lista ou tabela vazia: o que aconteceu e o que fazer. */
export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-9 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="text-[15px] text-ink-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
