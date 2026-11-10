import type { ReactNode } from "react";

import { Button } from "./button";
import { cx, TONS, type Tom } from "./variants";

/**
 * Resultado de uma ação de formulário: "Alterações salvas." ou o erro.
 * Erro é anunciado na hora (alert); sucesso, educadamente (status).
 * `id` serve para ligar a mensagem ao campo via aria-describedby.
 */
export function FormMessage({
  tone = "perigo",
  id,
  className,
  children,
}: {
  tone?: "ok" | "perigo";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p id={id} role={tone === "perigo" ? "alert" : "status"} className={cx("text-sm", TONS[tone].texto, className)}>
      {children}
    </p>
  );
}

/**
 * Texto curto colorido pelo tom — situação de animal, status de consulta.
 * `size="herda"` usa o tamanho do texto em volta.
 */
export function StatusText({
  tone,
  size = "sm",
  className,
  children,
}: {
  tone: Tom;
  size?: "sm" | "herda";
  className?: string;
  children: ReactNode;
}) {
  return <span className={cx("font-semibold", size === "sm" && "text-sm", TONS[tone].texto, className)}>{children}</span>;
}

/** Bolinha de tom, decorativa. */
export function Dot({ tone, className }: { tone: Tom; className?: string }) {
  return <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", TONS[tone].ponto, className)} />;
}

/** Faixa de aviso no topo de uma seção ("Animal em tratamento até…"). */
export function Callout({ tone = "aviso", className, children }: { tone?: "aviso" | "perigo"; className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-3 rounded-card border px-4 py-3 text-[15px] text-ink",
        tone === "aviso" ? "border-warn-border bg-warn-bg" : "border-danger-border bg-danger-bg",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Confirmação de exclusão dentro de um diálogo: a pergunta e "Não / Remover".
 * Aparece no lugar, sem abrir outro diálogo por cima.
 */
export function ConfirmBar({
  onCancel,
  onConfirm,
  confirmLabel = "Remover",
  pending = false,
  children,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  pending?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-danger-border bg-danger-bg px-4 py-3 text-[15px] text-ink">
      <span>{children}</span>
      <span className="flex gap-2">
        <Button onClick={onCancel}>Não</Button>
        <Button variant="perigoSolido" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </span>
    </div>
  );
}
