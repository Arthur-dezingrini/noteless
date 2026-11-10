import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import { CAMPO, cx, fieldClass } from "./variants";

/**
 * Rótulo + campo + dica/erro. O <label> envolve o campo, então não precisa de
 * htmlFor. `wide` ocupa as duas colunas num grid sm:grid-cols-2.
 */
export function Field({
  label,
  hint,
  error,
  wide = false,
  className,
  children,
}: {
  label: ReactNode;
  /** Texto cinza ao lado do rótulo, ex.: "(opcional)". */
  hint?: ReactNode;
  error?: string | null;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", wide && "sm:col-span-2", className)}>
      <span className="text-sm font-semibold text-ink">
        {label}
        {hint && <span className="font-normal text-ink-muted"> {hint}</span>}
      </span>
      {children}
      {error && <span className="text-sm text-danger">{error}</span>}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={fieldClass(className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cx(CAMPO, "px-3.5 py-2.5 leading-relaxed", className)} {...props} />;
}
