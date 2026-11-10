export const ABAS = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "pesagens", label: "Pesagens" },
  { value: "vacinas", label: "Vacinas" },
] as const;
export type Aba = (typeof ABAS)[number]["value"];

export const PAINEL = "painel-lote";

/** "AAAA-MM-DD" → "DD/MM". */
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const num = (v: number | null | undefined, casas = 1) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${num(v)}%`);
