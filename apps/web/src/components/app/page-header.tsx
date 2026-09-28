import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance text-ink">{title}</h1>
        {subtitle && <p className="text-base text-ink-muted">{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}
