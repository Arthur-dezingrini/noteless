/** Iniciais do nome num círculo — "Ana Lima" → "AL". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Paleta pastel do protótipo; a cor é estável por nome. */
const TONES = [
  "bg-brand-soft text-brand",
  "bg-blue-50 text-blue-600",
  "bg-purple-50 text-purple-600",
  "bg-amber-50 text-amber-700",
  "bg-pink-50 text-pink-600",
];

function toneFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length] ?? TONES[0]!;
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
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${toneFor(name)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
