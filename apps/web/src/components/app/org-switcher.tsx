"use client";

import type { Organization } from "@vocare/shared";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Logo } from "@/components/auth/logo";
import { authClient } from "@/lib/auth/client";

/**
 * Canto superior esquerdo: a organização ativa, e a troca entre as que o
 * usuário pertence. A escolha vai para a sessão (organization/set-active),
 * então vale em todas as abas e sobrevive a recarregar.
 */
export function OrgSwitcher({
  organizacoes,
  ativaId,
}: {
  organizacoes: Organization[];
  ativaId: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, start] = useTransition();
  const [trocandoPara, setTrocandoPara] = useState<string | null>(null);

  const ativa = organizacoes.find((o) => o.id === ativaId) ?? organizacoes[0];
  const podeTrocar = organizacoes.length > 1;

  function trocar(id: string) {
    if (id === ativa?.id) {
      setAberto(false);
      return;
    }
    setTrocandoPara(id);
    start(async () => {
      await authClient.organization.setActive({ organizationId: id });
      setAberto(false);
      setTrocandoPara(null);
      router.refresh();
    });
  }

  if (!ativa) {
    return <Logo tone="dark" subtitle="Sem organização" />;
  }

  if (!podeTrocar) {
    return <Logo tone="dark" subtitle={ativa.name} />;
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={`Organização ativa: ${ativa.name}. Trocar`}
        onClick={() => setAberto((v) => !v)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-surface"
      >
        <Logo tone="dark" subtitle={ativa.name} className="min-w-0 flex-1" />
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-ink-muted" />
        ) : (
          <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" />
        )}
      </button>

      {aberto && (
        <ul
          role="listbox"
          aria-label="Organizações"
          className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {organizacoes.map((o) => {
            const selecionada = o.id === ativa.id;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selecionada}
                  disabled={pending}
                  onClick={() => trocar(o.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-surface disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {trocandoPara === o.id ? (
                    <Loader2 className="size-4 animate-spin text-ink-muted" />
                  ) : (
                    selecionada && <Check className="size-4 text-brand" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
