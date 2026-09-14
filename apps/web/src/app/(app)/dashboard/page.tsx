import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/auth/logo";
import { requireSession } from "@/lib/auth/dal";

export default async function DashboardPage() {
  // Validação real da sessão, contra a api. O proxy só fez o palpite otimista.
  const { user } = await requireSession();

  return (
    <main className="min-h-svh">
      <header className="flex items-center justify-between border-b border-field-border px-6 py-4">
        <Logo tone="dark" />
        <LogoutButton />
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
