import type { ButtonHTMLAttributes } from "react";

import { Spinner } from "./spinner";
import { buttonClass, type VarianteBotao } from "./variants";

/**
 * Botão do kit. `loading` desabilita e mostra o giro. Para um <Link> com cara
 * de botão, use `buttonClass(variante)` no className do Link.
 */
export function Button({
  variant = "secundario",
  loading = false,
  type = "button",
  className,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: VarianteBotao; loading?: boolean }) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonClass(variant, className)} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
