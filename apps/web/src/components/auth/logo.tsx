import { BRAND_NAME } from "@/lib/brand";

type LogoProps = {
  /** "light" para fundo escuro/verde, "dark" para fundo branco. */
  tone?: "light" | "dark";
  /** Linha secundária, ex.: nome da organização ativa. */
  subtitle?: string;
  className?: string;
};

/** Marca do VOCare: as barras representam a onda de voz, que é o eixo do produto. */
export function Logo({ tone = "light", subtitle, className = "" }: LogoProps) {
  const isLight = tone === "light";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
          isLight ? "bg-white" : "bg-brand"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`size-4 ${isLight ? "text-brand" : "text-white"}`}
          fill="currentColor"
        >
          <rect x="6" y="5" width="4" height="14" rx="2" />
          <rect x="14" y="5" width="4" height="14" rx="2" />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={`block truncate text-base font-semibold tracking-tight ${
            isLight ? "text-white" : "text-ink"
          }`}
        >
          {BRAND_NAME}
        </span>
        {subtitle && (
          <span
            className={`block truncate text-xs ${
              isLight ? "text-white/75" : "text-ink-muted"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}
