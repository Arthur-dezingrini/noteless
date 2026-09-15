import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(16,35,63,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {aside}
    </div>
  );
}
