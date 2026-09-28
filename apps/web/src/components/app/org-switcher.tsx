"use client";

import type { Organization } from "@vocare/shared";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth/client";

function Conta({ nome, animais }: { nome: string; animais: number | null }) {
  return (
    <span className="flex min-w-0 flex-col gap-px text-left">
      <span className="truncate text-[15px] font-semibold text-ink">{nome}</span>
      {animais !== null && (
        <span className="text-[13px] font-medium text-ink-muted">
          {animais} {animais === 1 ? "animal" : "animais"}
        </span>
      )}
    </span>
  );
}

/**
 * A conta ativa (sítio, fazenda, clínica…) e a troca entre as que o usuário
 * pertence. A escolha vai para a sessão, então vale em todas as abas.
 */
export function OrgSwitcher({
  organizacoes,
  ativaId,
  animais,
}: {
  organizacoes: Organization[];
  ativaId: string | null;
  /** Quantos animais a conta ativa tem. */
  animais: number | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, start] = useTransition();
  const [trocandoPara, setTrocandoPara] = useState<string | null>(null);

  const ativa = organizacoes.find((o) => o.id === ativaId) ?? organizacoes[0];

  function trocar(id: string) {
    if (id === ativa?.id) return setAberto(false);
    setTrocandoPara(id);
    start(async () => {
      await authClient.organization.setActive({ organizationId: id });
      setAberto(false);
      setTrocandoPara(null);
      router.refresh();
    });
  }

  if (!ativa) return <div className="px-2.5 py-2"><Conta nome="Sem conta" animais={null} /></div>;
  if (organizacoes.length < 2) return <div className="px-2.5 py-2"><Conta nome={ativa.name} animais={animais} /></div>;

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
        aria-label={`Conta: ${ativa.name}. Trocar de conta`}
        onClick={() => setAberto((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition hover:bg-hover"
      >
        <Conta nome={ativa.name} animais={animais} />
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-ink-muted" />
        ) : (
          <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" />
        )}
      </button>

      {aberto && (
        <ul
          role="listbox"
          aria-label="Contas"
          className="absolute top-full left-0 z-20 mt-1 w-full overflow-hidden rounded-field border border-line bg-white py-1 shadow-lg"
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
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[15px] text-ink hover:bg-hover disabled:opacity-60"
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
