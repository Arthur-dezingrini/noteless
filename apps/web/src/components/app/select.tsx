import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/**
 * <select> nativo com a seta desenhada por nós: a do navegador cola na borda
 * e não dá para afastar. O visual (borda, foco, altura) é o mesmo dos inputs.
 */
export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative block ${className}`}>
      <select
        {...props}
        className="w-full appearance-none rounded-lg border border-field-border bg-white py-2.5 pr-10 pl-3.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-surface disabled:text-ink-muted"
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
      />
    </span>
  );
}
