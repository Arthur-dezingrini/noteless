/**
 * Classes de botão e campo do redesign, num lugar só. Regra: um botão
 * primário por tela; o resto é secundário.
 */
export const btn = {
  primario:
    "inline-flex h-[42px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-field bg-brand px-4 text-[15px] font-semibold text-white transition hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-muted",
  secundario:
    "inline-flex h-[42px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-field border border-button-border bg-white px-3.5 text-[15px] font-semibold text-ink transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60",
  perigo:
    "inline-flex h-[42px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-field px-3.5 text-[15px] font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-60",
  /** Confirmação de exclusão dentro de um diálogo — a única ação principal ali. */
  perigoSolido:
    "inline-flex h-[42px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-field bg-danger px-4 text-[15px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
  /** Ações pequenas dentro de linhas de lista. */
  pequeno:
    "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-field border border-button-border bg-white px-3 text-sm font-semibold text-ink transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40",
  pequenoPerigo:
    "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-field border border-button-border bg-white px-3 text-sm font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-40",
  link: "cursor-pointer text-[15px] font-semibold text-brand-ink hover:underline",
};

/** Input/textarea. O <Select> usa o mesmo visual. */
export const campo =
  "h-11 w-full rounded-field border border-field-border bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-field-border-focus focus:ring-2 focus:ring-brand/20 disabled:bg-surface disabled:text-ink-muted";
