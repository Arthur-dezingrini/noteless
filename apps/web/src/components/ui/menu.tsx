import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./variants";

/**
 * Caixa de menu suspenso. Quem usa guarda o aberto/fechado e posiciona com
 * `className` (ex.: "absolute top-[50px] right-3").
 */
export function Menu({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      role="menu"
      className={cx(
        "z-10 flex w-[210px] flex-col rounded-card border border-line bg-white p-1.5 shadow-[0_16px_32px_-16px_rgba(0,0,0,.25)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({ danger = false, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx(
        "cursor-pointer rounded-lg px-2.5 py-[9px] text-left text-[15px] hover:bg-hover",
        danger ? "text-danger" : "text-ink",
        className,
      )}
      {...props}
    />
  );
}
