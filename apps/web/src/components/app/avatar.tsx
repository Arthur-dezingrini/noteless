/** Iniciais do nome num círculo — "Ana Lima" → "AL". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand ${className}`}
    >
      {initials(name)}
    </span>
  );
}
