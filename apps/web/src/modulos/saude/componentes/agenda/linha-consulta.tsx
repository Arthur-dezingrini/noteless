"use client";

import { ROTULO_STATUS_CONSULTA, ROTULO_TIPO_CONSULTA, type Consulta } from "@vocare/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { buttonClass, cx, Menu, MenuItem, StatusText } from "@/components/ui";
import { duracao, nomeAlvo, TOM_STATUS } from "./util";

export function LinhaConsulta({
  c,
  primeira,
  onConcluir,
  onCancelar,
  onReabrir,
  onRemarcar,
}: {
  c: Consulta;
  primeira: boolean;
  onConcluir: () => void;
  onCancelar: () => void;
  onReabrir: () => void;
  onRemarcar: () => void;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const caixa = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => caixa.current && !caixa.current.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const fechada = c.status === "concluida" || c.status === "cancelada";
  const acoes: { rotulo: string; fazer: () => void; perigo?: boolean }[] = [
    ...(!fechada ? [{ rotulo: "Marcar como concluída", fazer: onConcluir }] : []),
    { rotulo: "Remarcar", fazer: onRemarcar },
    ...(c.prontuarioId
      ? [
          {
            rotulo: "Ver atendimento",
            fazer: () => router.push(`/prontuarios?id=${c.prontuarioId}`),
          },
        ]
      : c.animalId && c.status !== "cancelada"
        ? [
            {
              rotulo: "Registrar atendimento",
              fazer: () => router.push(`/prontuarios?consulta=${c.id}`),
            },
          ]
        : []),
    ...(c.animalId
      ? [
          {
            rotulo: "Ver ficha do animal",
            fazer: () => router.push(`/animais/${c.animalId}`),
          },
        ]
      : []),
    ...(fechada
      ? [{ rotulo: "Voltar para agendada", fazer: onReabrir }]
      : [{ rotulo: "Cancelar consulta", fazer: onCancelar, perigo: true }]),
  ];

  return (
    <li ref={caixa} className={cx("relative flex items-center gap-3.5 py-3.5 pr-3 pl-[18px]", !primeira && "border-t border-line")}>
      <span className="flex w-[52px] shrink-0 flex-col">
        <span className="text-[15px] font-semibold text-ink tabular-nums">{c.hora}</span>
        <span className="text-[13px] text-ink-muted">{duracao(c.duracaoMin)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {c.animalId ? (
          <Link href={`/animais/${c.animalId}`} className="truncate text-[15px] font-semibold text-ink no-underline hover:underline">
            {nomeAlvo(c)}
          </Link>
        ) : (
          <span className="truncate text-[15px] font-semibold text-ink">{nomeAlvo(c)}</span>
        )}
        <span className="truncate text-sm text-ink-muted">
          {[ROTULO_TIPO_CONSULTA[c.tipo], c.local].filter(Boolean).join(" · ")}
          {c.observacoes && <span className="hidden sm:inline"> · {c.observacoes}</span>}
        </span>
      </span>
      <span className="hidden w-28 truncate text-sm text-ink-soft xl:block">{c.veterinarioNome ?? "—"}</span>
      <span className="w-24">
        <StatusText tone={TOM_STATUS[c.status]}>{ROTULO_STATUS_CONSULTA[c.status]}</StatusText>
      </span>
      <button
        type="button"
        onClick={() => setMenu((v) => !v)}
        aria-label={`Mais ações: ${nomeAlvo(c)} às ${c.hora}`}
        aria-expanded={menu}
        className={buttonClass("iconePequeno", cx("text-lg leading-none text-ink-muted", menu && "bg-surface"))}
      >
        …
      </button>
      {menu && (
        <Menu className="absolute top-[50px] right-3">
          {acoes.map((a) => (
            <MenuItem
              key={a.rotulo}
              danger={a.perigo}
              onClick={() => {
                setMenu(false);
                a.fazer();
              }}
            >
              {a.rotulo}
            </MenuItem>
          ))}
        </Menu>
      )}
    </li>
  );
}

/** Semana de segunda a sexta (sábado e domingo aparecem se tiverem algo). Arrastar remarca. */
