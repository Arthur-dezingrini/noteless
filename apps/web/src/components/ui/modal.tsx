"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { buttonClass, cx } from "./variants";

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
      className={cx("m-auto w-full rounded-dialog border border-line bg-white p-0 shadow-xl backdrop:bg-ink/40", wide ? "max-w-[600px]" : "max-w-[480px]")}
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
          className={buttonClass("icone")}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}

/**
 * Rodapé fixo do diálogo, encostado nas bordas. `start` fica à esquerda
 * (ex.: Excluir); as ações principais vão em children, à direita.
 */
export function ModalFooter({ start, children }: { start?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("-mx-6 -mb-6 flex items-center gap-2 border-t border-line px-6 py-4", start ? "justify-between" : "justify-end")}>
      {start}
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
