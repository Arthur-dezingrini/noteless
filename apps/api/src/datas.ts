/** "AAAA-MM-DD" do instante `d` no fuso de São Paulo. */
export function dataISOEmSP(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

/** "AAAA-MM-DD" em São Paulo (de hoje, sem argumento) — a IA precisa saber que dia é. */
export function hojeISO(quando = new Date()) {
  return dataISOEmSP(quando);
}

/** `data` ("AAAA-MM-DD") deslocada em `dias`. */
export function noDia(data: string, dias: number) {
  const [a = 0, m = 1, d = 1] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" como "DD/MM". */
export function br(iso: string) {
  return iso.split("-").reverse().slice(0, 2).join("/");
}
