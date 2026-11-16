import { TERMOS_EM_VIGOR } from "@vocare/shared";

import { Logo } from "@/components/auth/logo";

/** Páginas abertas, sem login: os textos legais e o aviso de quem usa o gravador. */
export default function PublicoLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="min-h-svh bg-page px-4 py-10 sm:px-6 print:bg-white print:py-0">
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-6">
        <Logo className="print:hidden" />
        {!TERMOS_EM_VIGOR && (
          <p role="note" className="rounded-lg border border-line-soft bg-surface px-4 py-3 text-sm font-semibold text-ink-soft">
            Rascunho em revisão — este texto ainda não está em vigor.
          </p>
        )}
        {children}
      </div>
    </main>
  );
}
