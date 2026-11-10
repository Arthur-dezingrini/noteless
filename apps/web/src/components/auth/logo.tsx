import { BRAND_NAME } from "@/lib/brand";

type LogoProps = {
  /** "light" para fundo verde, "dark" para fundo claro. */
  tone?: "light" | "dark";
  className?: string;
};

/**
 * Marca do Noteless: uma nota com uma onda de voz no lugar do texto — o que
 * foi falado vira registro. A dobra e as barras são recortes que mostram o
 * fundo, então a mesma forma serve sobre o claro e sobre o verde.
 */
export function Logo({ tone = "dark", className = "" }: LogoProps) {
  const claro = tone === "light";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 shrink-0">
        <path
          className={claro ? "fill-white" : "fill-brand"}
          fillRule="evenodd"
          d="M9.5 2.5H18.45V7.7a3.45 3.45 0 0 0 3.45 3.45H27V25a4.5 4.5 0 0 1-4.5 4.5h-13A4.5 4.5 0 0 1 5 25V7a4.5 4.5 0 0 1 4.5-4.5ZM20.35 3.45V7.7a1.55 1.55 0 0 0 1.55 1.55h4.25ZM8.2 18a1.2 1.2 0 0 1 2.4 0v3a1.2 1.2 0 0 1-2.4 0Zm4.4-3.5a1.2 1.2 0 0 1 2.4 0v10a1.2 1.2 0 0 1-2.4 0Zm4.4 2a1.2 1.2 0 0 1 2.4 0v6a1.2 1.2 0 0 1-2.4 0Zm4.4 2.25a1.2 1.2 0 0 1 2.4 0v1.5a1.2 1.2 0 0 1-2.4 0Z"
        />
      </svg>
      <span className={`text-[19px] font-bold tracking-tight ${claro ? "text-white" : "text-ink"}`}>{BRAND_NAME}</span>
    </div>
  );
}
