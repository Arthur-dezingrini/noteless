import { BRAND_NAME } from "@/lib/brand";

type LogoProps = {
  /** "light" para fundo verde, "dark" para fundo claro. */
  tone?: "light" | "dark";
  className?: string;
};

/** Marca do Taiplan: brinco de gado com um check — o animal identificado e o registro feito. */
export function Logo({ tone = "dark", className = "" }: LogoProps) {
  const claro = tone === "light";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 shrink-0">
        <path
          className={claro ? "fill-white" : "fill-brand"}
          fillRule="evenodd"
          d="M16 2.5c2.2 0 4 1.8 4 4v1l5.3 3.4c1.1.7 1.7 1.9 1.7 3.1V24c0 3-2.5 5.5-5.5 5.5h-11C7.5 29.5 5 27 5 24V14c0-1.2.6-2.4 1.7-3.1L12 7.5v-1c0-2.2 1.8-4 4-4Zm0 2.4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4Z"
        />
        <path
          className={claro ? "stroke-brand" : "stroke-white"}
          d="M10.5 18l4.5 5.2L22 14.5"
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-[19px] font-bold tracking-tight ${claro ? "text-white" : "text-ink"}`}>{BRAND_NAME}</span>
    </div>
  );
}
