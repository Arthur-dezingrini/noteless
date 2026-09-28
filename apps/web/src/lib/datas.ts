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

/** "há 12 min", "há 2 h", "ontem", ou a data — para listas de "recebido". */
export function haQuantoTempo(d: Date, agora = new Date()): string {
  const min = Math.round((agora.getTime() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.round(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: TZ }).format(d);
}

/** 74 → "1:14" */
export function duracaoCurta(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "3 anos", "8 meses", "menos de 1 mês" — a partir de "AAAA-MM-DD". */
export function idade(nascimento: string | null | undefined, hoje = hojeISO()): string | null {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  let meses = (ha! - a!) * 12 + (hm! - m!);
  if (hd! < d!) meses -= 1;
  if (meses < 0) return null;
  const anos = Math.floor(meses / 12);
  if (anos >= 1) return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  if (meses >= 1) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  return "menos de 1 mês";
}
