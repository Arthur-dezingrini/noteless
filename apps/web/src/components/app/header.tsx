import { Bell } from "lucide-react";

/**
 * Topo da área logada: só o sino. Quem está logado e o "Sair" ficam no
 * rodapé do menu lateral.
 */
export function Header({ naoLidas }: { naoLidas: number }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-line px-6">
      <button
        type="button"
        aria-label={naoLidas ? `Notificações, ${naoLidas} novas` : "Notificações"}
        className="relative grid size-10 place-items-center rounded-field text-ink hover:bg-surface"
      >
        <Bell className="size-5" />
        {naoLidas > 0 && (
          <span className="absolute top-1 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-notify px-1 text-[11px] font-bold text-white ring-2 ring-page">
            {naoLidas}
          </span>
        )}
      </button>
    </header>
  );
}
