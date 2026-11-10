import type { CampoApontamento } from "./lotes";
import { LIMITE_MORTALIDADE_DIA } from "./lotes";

export type ApontamentoDia = { data: string; instalacaoId: string } & Partial<
  Record<CampoApontamento, number | null>
>;

type Plantel = { femeas: number; machos: number };
type DadosLote = {
  dataAlojamento: string;
  idadeAlojamentoDias: number;
  femeasIniciais: number;
  machosIniciais: number;
};

export type IndicadoresDia = {
  posturaPct: number | null;
  incubaveisPct: number | null;
  racaoGAveDia: number | null;
  aguaRacao: number | null;
  mortalidadeDiaPct: number | null;
};

export type IndicadoresLote = {
  vivas: Plantel;
  mortalidadeAcumuladaPct: number | null;
  posturaSemanaPct: number | null;
  incubaveisPorFemea: number | null;
  racaoGAveDiaSemana: number | null;
};

export type SemanaLote = {
  semana: number;
  inicio: string;
  fim: string;
  mortas: number;
  eliminadas: number;
  mortalidadePct: number | null;
  posturaPct: number | null;
  incubaveisPct: number | null;
  racaoGAveDia: number | null;
  pesoFemeaG: number | null;
  pesoMachoG: number | null;
  uniformidadeFemeaPct: number | null;
  uniformidadeMachoPct: number | null;
};

export type PesagemSemana = {
  data: string;
  sexo: "femea" | "macho";
  pesoMedioG: number;
  uniformidadePct: number | null;
};

const MS_DIA = 86_400_000;

function utc(data: string): number {
  const [a = 0, m = 1, d = 1] = data.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / MS_DIA);
}

function somarDias(data: string, dias: number): string {
  return new Date(utc(data) + dias * MS_DIA).toISOString().slice(0, 10);
}

function arredondar(n: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

const n = (v: number | null | undefined) => v ?? 0;

export function semanaDeVida(dataAlojamento: string, idadeAlojamentoDias: number, data: string): number {
  return Math.floor((diasEntre(dataAlojamento, data) + idadeAlojamentoDias) / 7) + 1;
}

function baixas(ap: ApontamentoDia): Plantel {
  return {
    femeas: n(ap.mortasFemeas) + n(ap.eliminadasFemeas),
    machos: n(ap.mortasMachos) + n(ap.eliminadasMachos),
  };
}

/** Aves vivas somando as baixas dos apontamentos com data <= `ate` (ou < `ate`, se `inclusive` for false). */
function vivasAte(iniciais: Plantel, aps: ApontamentoDia[], ate: string, inclusive: boolean): Plantel {
  let femeas = iniciais.femeas;
  let machos = iniciais.machos;
  for (const ap of aps) {
    if (inclusive ? ap.data > ate : ap.data >= ate) continue;
    const b = baixas(ap);
    femeas -= b.femeas;
    machos -= b.machos;
  }
  return { femeas, machos };
}

export function avesVivas(iniciais: Plantel, aps: ApontamentoDia[], ate: string): Plantel {
  return vivasAte(iniciais, aps, ate, true);
}

export function razao(parte: number | null | undefined, todo: number | null | undefined): number | null {
  if (parte == null || todo == null || todo <= 0) return null;
  return parte / todo;
}

function pct(parte: number | null | undefined, todo: number | null | undefined): number | null {
  const r = razao(parte, todo);
  return r == null ? null : arredondar(r * 100, 1);
}

export function indicadoresDoDia(ap: ApontamentoDia, vivasInicioDia: Plantel): IndicadoresDia {
  const b = baixas(ap);
  const g = razao(ap.racaoKg == null ? null : ap.racaoKg * 1000, vivasInicioDia.femeas + vivasInicioDia.machos);
  const agua = ap.racaoKg != null && ap.racaoKg > 0 ? razao(ap.aguaL, ap.racaoKg) : null;
  return {
    posturaPct: pct(ap.ovosTotal, vivasInicioDia.femeas),
    incubaveisPct: pct(ap.ovosIncubaveis, ap.ovosTotal),
    racaoGAveDia: g == null ? null : arredondar(g, 1),
    aguaRacao: agua == null ? null : arredondar(agua, 2),
    mortalidadeDiaPct: pct(b.femeas + b.machos, vivasInicioDia.femeas + vivasInicioDia.machos),
  };
}

export function mortalidadeAlta(ap: ApontamentoDia, vivasInicioDia: Plantel): boolean {
  const b = baixas(ap);
  return b.femeas + b.machos > LIMITE_MORTALIDADE_DIA * (vivasInicioDia.femeas + vivasInicioDia.machos);
}

/** Soma os apontamentos de vários galpões no mesmo dia, em ordem de data. */
function somarPorDia(aps: ApontamentoDia[]): ApontamentoDia[] {
  const porDia = new Map<string, ApontamentoDia>();
  for (const ap of aps) {
    const atual = porDia.get(ap.data) ?? { data: ap.data, instalacaoId: "" };
    const alvo = atual as Record<string, number | string | null | undefined>;
    for (const [k, v] of Object.entries(ap)) {
      if (k === "data" || k === "instalacaoId" || typeof v !== "number") continue;
      alvo[k] = n(alvo[k] as number | undefined) + v;
    }
    porDia.set(ap.data, atual);
  }
  return [...porDia.values()].sort((a, b) => (a.data < b.data ? -1 : 1));
}

type Acumulado = { ovos: number; femeasDia: number; incub: number; ovosComIncub: number; racaoG: number; avesDia: number };

/** Acumula, dia a dia, os termos das razões de postura, incubáveis e ração. */
function acumular(dias: ApontamentoDia[], lote: DadosLote, todos: ApontamentoDia[]): Acumulado {
  const iniciais = { femeas: lote.femeasIniciais, machos: lote.machosIniciais };
  const acc: Acumulado = { ovos: 0, femeasDia: 0, incub: 0, ovosComIncub: 0, racaoG: 0, avesDia: 0 };
  for (const ap of dias) {
    const v = vivasAte(iniciais, todos, ap.data, false);
    if (ap.ovosTotal != null) {
      acc.ovos += ap.ovosTotal;
      acc.femeasDia += v.femeas;
      if (ap.ovosIncubaveis != null) {
        acc.incub += ap.ovosIncubaveis;
        acc.ovosComIncub += ap.ovosTotal;
      }
    }
    if (ap.racaoKg != null) {
      acc.racaoG += ap.racaoKg * 1000;
      acc.avesDia += v.femeas + v.machos;
    }
  }
  return acc;
}

function umaCasa(v: number | null): number | null {
  return v == null ? null : arredondar(v, 1);
}

export function indicadoresDoLote(lote: DadosLote, aps: ApontamentoDia[], hoje: string): IndicadoresLote {
  const dias = somarPorDia(aps);
  const iniciais = { femeas: lote.femeasIniciais, machos: lote.machosIniciais };
  const vivas = avesVivas(iniciais, dias, hoje);
  const totalInicial = iniciais.femeas + iniciais.machos;

  const semana = semanaDeVida(lote.dataAlojamento, lote.idadeAlojamentoDias, hoje);
  const daSemana = dias.filter(
    (d) => d.data <= hoje && semanaDeVida(lote.dataAlojamento, lote.idadeAlojamentoDias, d.data) === semana,
  );
  const acc = acumular(daSemana, lote, dias);
  const incubaveis = dias.filter((d) => d.data <= hoje).reduce((s, d) => s + n(d.ovosIncubaveis), 0);
  const incubPorFemea = razao(incubaveis, lote.femeasIniciais);

  return {
    vivas,
    mortalidadeAcumuladaPct: pct(totalInicial - vivas.femeas - vivas.machos, totalInicial),
    posturaSemanaPct: umaCasa(razao(acc.ovos * 100, acc.femeasDia)),
    incubaveisPorFemea: incubPorFemea == null ? null : arredondar(incubPorFemea, 2),
    racaoGAveDiaSemana: umaCasa(razao(acc.racaoG, acc.avesDia)),
  };
}

export function consolidarSemanas(lote: DadosLote, aps: ApontamentoDia[], pesagens: PesagemSemana[]): SemanaLote[] {
  const dias = somarPorDia(aps);
  const iniciais = { femeas: lote.femeasIniciais, machos: lote.machosIniciais };
  const sem = (data: string) => semanaDeVida(lote.dataAlojamento, lote.idadeAlojamentoDias, data);

  const numeros = new Set<number>([...dias.map((d) => sem(d.data)), ...pesagens.map((p) => sem(p.data))]);
  return [...numeros]
    .sort((a, b) => a - b)
    .map((semana) => {
      const inicio = somarDias(lote.dataAlojamento, (semana - 1) * 7 - lote.idadeAlojamentoDias);
      const inicioReal = inicio < lote.dataAlojamento ? lote.dataAlojamento : inicio;
      const fim = somarDias(inicio, 6);
      const doPeriodo = dias.filter((d) => sem(d.data) === semana);
      const acc = acumular(doPeriodo, lote, dias);
      const mortas = doPeriodo.reduce((s, d) => s + n(d.mortasFemeas) + n(d.mortasMachos), 0);
      const eliminadas = doPeriodo.reduce((s, d) => s + n(d.eliminadasFemeas) + n(d.eliminadasMachos), 0);
      const ultima = (sexo: "femea" | "macho") =>
        pesagens
          .filter((p) => p.sexo === sexo && sem(p.data) === semana)
          .sort((a, b) => (a.data < b.data ? -1 : 1))
          .at(-1);
      const f = ultima("femea");
      const m = ultima("macho");
      return {
        semana,
        inicio: inicioReal,
        fim,
        mortas,
        eliminadas,
        mortalidadePct: pct(mortas + eliminadas, lote.femeasIniciais + lote.machosIniciais),
        posturaPct: umaCasa(razao(acc.ovos * 100, acc.femeasDia)),
        incubaveisPct: umaCasa(razao(acc.incub * 100, acc.ovosComIncub)),
        racaoGAveDia: umaCasa(razao(acc.racaoG, acc.avesDia)),
        pesoFemeaG: f?.pesoMedioG ?? null,
        pesoMachoG: m?.pesoMedioG ?? null,
        uniformidadeFemeaPct: f?.uniformidadePct ?? null,
        uniformidadeMachoPct: m?.uniformidadePct ?? null,
      };
    });
}
