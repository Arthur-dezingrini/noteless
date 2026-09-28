export type Tone = "green" | "yellow" | "red" | "gray";

const TONES: Record<Tone, string> = {
  green: "text-brand-ink",
  yellow: "text-warn",
  red: "text-danger",
  gray: "text-ink-muted",
};

/** Status é texto colorido, não pílula. */
export function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`text-sm font-semibold whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
}
