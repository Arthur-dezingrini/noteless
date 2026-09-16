/**
 * Datas como "YYYY-MM-DD" e nada de fuso no meio do caminho: o dia é o mesmo
 * no servidor e no cliente, então não há descompasso de hidratação. Para
 * formatar, o dia vira um Date ao meio-dia UTC e o Intl é chamado em UTC.
 */
export const TZ = "America/Sao_Paulo";

export function hojeISO(): string {
  // "en-CA" formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function paraDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function paraISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function adicionarDias(iso: string, dias: number): string {
  const d = paraDate(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraISO(d);
}

/** Domingo da semana que contém o dia. */
export function inicioDaSemana(iso: string): string {
  return adicionarDias(iso, -paraDate(iso).getUTCDay());
}

export function formatar(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: "UTC" }).format(paraDate(iso));
}

/** "Terça-feira, 1 de setembro de 2026" */
export function dataExtenso(iso: string): string {
  const s = formatar(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Setembro 2026" */
export function mesAno(ano: number, mes: number): string {
  const s = formatar(`${ano}-${String(mes).padStart(2, "0")}-01`, { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(" de ", " ");
}

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
