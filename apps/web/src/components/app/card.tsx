import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-white ${className}`}>{children}</section>;
}

export function CardHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {aside}
    </div>
  );
}
