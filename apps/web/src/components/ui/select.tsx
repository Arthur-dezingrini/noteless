import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

import { CAMPO, cx } from "./variants";

/**
 * <select> nativo com a seta desenhada por nós: a do navegador cola na borda
 * e não dá para afastar. O visual (borda, foco, altura) é o mesmo dos inputs.
 */
export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx("relative block", className)}>
      <select
        {...props}
        className={cx(CAMPO, "h-11 appearance-none pr-10 pl-3.5")}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
}
