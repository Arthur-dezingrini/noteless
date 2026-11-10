/**
 * Classes do kit de UI, num lugar só. Os componentes de `@/components/ui`
 * usam estas funções; use-as direto só quando o elemento não pode ser o
 * componente (ex.: um <Link> com cara de botão).
 *
 * Regra: um botão primário por tela; o resto é secundário.
 */

/** Junta classes ignorando vazios: cx("a", cond && "b", undefined) → "a b". */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const BASE_BOTAO =
  "inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold no-underline transition disabled:cursor-not-allowed";

export const VARIANTES_BOTAO = {
  primario:
    "h-[42px] gap-2 rounded-field bg-brand px-4 text-[15px] text-white hover:bg-brand-hover active:bg-brand-active disabled:bg-surface disabled:text-ink-muted",
  secundario:
    "h-[42px] gap-2 rounded-field border border-button-border bg-white px-3.5 text-[15px] text-ink hover:bg-hover disabled:opacity-60",
  /** Ação discreta sem borda (Cancelar, Voltar). */
  fantasma: "h-[42px] gap-2 rounded-field px-3.5 text-[15px] text-ink hover:bg-hover disabled:opacity-60",
  perigo: "h-[42px] gap-2 rounded-field px-3.5 text-[15px] text-danger hover:bg-danger-bg disabled:opacity-60",
  /** Confirmação de exclusão dentro de um diálogo — a única ação principal ali. */
  perigoSolido: "h-[42px] gap-2 rounded-field bg-danger px-4 text-[15px] text-white hover:opacity-90 disabled:opacity-60",
  /** Ações pequenas dentro de linhas de lista. */
  pequeno:
    "h-9 gap-1.5 rounded-field border border-button-border bg-white px-3 text-sm text-ink hover:bg-hover disabled:opacity-40",
  pequenoPerigo:
    "h-9 gap-1.5 rounded-field border border-button-border bg-white px-3 text-sm text-danger hover:bg-danger-bg disabled:opacity-40",
  /** Só ícone (fechar, mais opções). Exige aria-label. */
  icone: "size-9 rounded-field text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-40",
  /** Ícone compacto (setas de calendário, "…" de linha). Exige aria-label. */
  iconePequeno: "size-8 rounded-lg text-ink-soft hover:bg-surface disabled:opacity-40",
  /** Ação de texto dentro de uma linha de lista (Editar, Remover). */
  linha: "rounded-lg px-2.5 py-1.5 text-sm text-ink hover:bg-hover disabled:opacity-40",
  linhaPerigo: "rounded-lg px-2.5 py-1.5 text-sm text-danger hover:bg-danger-bg disabled:opacity-40",
  link: "text-[15px] text-brand-ink hover:underline",
} as const;

export type VarianteBotao = keyof typeof VARIANTES_BOTAO;

export function buttonClass(variante: VarianteBotao = "secundario", extra?: string): string {
  return cx(BASE_BOTAO, VARIANTES_BOTAO[variante], extra);
}

/** Input/textarea/select: mesma borda, foco e altura. */
export const CAMPO =
  "w-full rounded-field border border-field-border bg-white text-[15px] text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-field-border-focus focus:ring-2 focus:ring-brand/20 disabled:bg-surface disabled:text-ink-muted aria-invalid:border-danger";

export function fieldClass(extra?: string): string {
  return cx(CAMPO, "h-11 px-3.5", extra);
}

/** Tom semântico de texto e de bolinha. Status de domínio mapeiam para um destes. */
export const TONS = {
  ok: { texto: "text-brand-ink", ponto: "bg-brand", fundo: "bg-brand-soft" },
  aviso: { texto: "text-warn", ponto: "bg-warn-dot", fundo: "bg-warn-bg" },
  perigo: { texto: "text-danger", ponto: "bg-danger", fundo: "bg-danger-bg" },
  neutro: { texto: "text-ink-muted", ponto: "bg-ink-muted", fundo: "bg-surface" },
} as const;

export type Tom = keyof typeof TONS;

/** Tabela dentro de <Card>: cabeçalho, células e linha clicável. */
export const tabela = {
  table: "w-full table-fixed text-left text-[15px]",
  thead: "border-b border-line bg-detail text-[13px] font-semibold text-ink-muted",
  th: "px-3 py-3 font-semibold first:pl-[18px]",
  td: "px-3 py-3 first:pl-[18px]",
  linha: "border-t border-line-soft first:border-t-0",
  linhaClicavel:
    "cursor-pointer border-t border-line-soft first:border-t-0 hover:bg-detail focus-visible:bg-detail focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
} as const;
