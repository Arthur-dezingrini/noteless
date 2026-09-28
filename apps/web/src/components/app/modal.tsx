"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Diálogo modal em cima do <dialog> nativo: foco preso, Esc fecha, fundo
 * escurecido, sem biblioteca.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Formulários em duas colunas precisam de mais largura. */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clique no backdrop (fora do conteúdo) fecha.
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-full ${wide ? "max-w-[600px]" : "max-w-[480px]"} rounded-dialog border border-line bg-white p-0 shadow-xl backdrop:bg-ink/40`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid size-9 place-items-center rounded-field text-ink-muted transition hover:bg-surface hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
