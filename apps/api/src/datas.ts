/** "AAAA-MM-DD" de hoje em São Paulo — a IA precisa saber que dia é. */
export function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
