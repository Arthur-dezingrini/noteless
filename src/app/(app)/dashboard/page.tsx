import { LogOut } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { requireSession } from "@/lib/auth/dal";
import { Logo } from "@/components/auth/logo";

export default async function DashboardPage() {
  // Validação real da sessão, contra o banco. O proxy só fez o palpite otimista.
  const { user } = await requireSession();

  return (
    <main className="min-h-svh">
      <header className="flex items-center justify-between border-b border-field-border px-6 py-4">
        <Logo tone="dark" />
        <form action={logout}>
          <button
            type="submit"
            className="flex cursor-pointer items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-black/5 hover:text-ink"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </form>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Olá, {user.name || user.email}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          A autenticação está funcionando. Esta página é só o ponto de chegada —
          o painel de revisão de sugestões de voz entra aqui.
        </p>
      </div>
    </main>
  );
}
