"use client";

import { rotuloAnimal, type Animal, type Grupo } from "@vocare/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonClass, Card, cx, FormMessage, PageHeader } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { BRAND_NAME } from "@/lib/brand";
import { corpo, rotuloEspecie } from "./comum";
import { GrupoModal } from "./grupo-modal";
import { MembroModal } from "./membro-modal";

export function GruposView({
  orgId,
  grupos,
  animais,
  possoRemover,
}: {
  orgId: string;
  grupos: Grupo[];
  animais: Animal[];
  possoRemover: boolean;
}) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(null);
  const [modal, setModal] = useState<"novo" | "editar" | "membro" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, start] = useTransition();
  const porId = new Map(animais.map((a) => [a.id, a]));
  const sel = grupos.find((g) => g.id === selId) ?? grupos[0];

  function tirar(g: Grupo, animalId: string) {
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/grupos/${g.id}`, {
        method: "PATCH",
        body: corpo(g, g.animalIds.filter((id) => id !== animalId)),
      });
      if (err) return setErro(err);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grupos"
        description={`Junte animais que recebem o mesmo cuidado. Quando alguém falar o nome do grupo no microfone do ${BRAND_NAME}, o registro vai para todos.`}
        actions={<Button onClick={() => setModal("novo")}>Criar grupo</Button>}
      />

      {erro && <FormMessage>{erro}</FormMessage>}

      {!sel ? (
        <div className="flex max-w-xl flex-col gap-1.5 py-6">
          <p className="text-lg font-semibold text-ink">Nenhum grupo ainda</p>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Crie um grupo para cada lote, baia ou turma — “Lote 4”, “Bezerros”, “Cães da casa”. Depois é só falar “vacinei o Lote 4” e vale para
            todos.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-7">
          <ul aria-label="Grupos" className="flex max-w-[300px] min-w-0 flex-[1_1_15rem] flex-col gap-0.5">
            {grupos.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setSelId(g.id)}
                  aria-current={g.id === sel.id ? "true" : undefined}
                  className={cx("flex w-full cursor-pointer flex-col gap-[3px] rounded-field px-3.5 py-3 text-left", g.id === sel.id ? "bg-surface" : "hover:bg-hover")}
                >
                  <span className="text-[15px] font-semibold text-ink">{g.nome}</span>
                  <span className="text-sm text-ink-muted">
                    {[`${g.animalIds.length} ${g.animalIds.length === 1 ? "animal" : "animais"}`, rotuloEspecie(g.especie)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <Card as="section" aria-label={sel.nome} className="flex min-w-0 flex-[999_1_28rem] flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-[22px]">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-ink">{sel.nome}</h2>
                <p className="text-[15px] text-ink-muted">{[rotuloEspecie(sel.especie), sel.local].filter(Boolean).join(" · ") || "Sem espécie ou local"}</p>
              </div>
              <Button variant="fantasma" onClick={() => setModal("editar")}>
                Editar
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-3.5 border-t border-line-soft px-6 py-4">
              <div className="flex flex-[1_1_12rem] flex-col gap-1">
                <span className="text-sm font-semibold text-ink-muted">Próximo</span>
                <span className="text-[15px] text-ink">{sel.proximo ?? "Nada marcado"}</span>
              </div>
              <div className="flex flex-[1_1_12rem] flex-col gap-1">
                <span className="text-sm font-semibold text-ink-muted">Último registro</span>
                <span className="text-[15px] text-ink">{sel.ultimo ?? "Nada registrado"}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line-soft px-6 pt-4 pb-1.5">
              <span className="text-sm font-semibold text-ink-muted">
                {sel.animalIds.length} {sel.animalIds.length === 1 ? "animal" : "animais"}
              </span>
              <button type="button" onClick={() => setModal("membro")} className="cursor-pointer text-[15px] font-semibold text-brand-ink">
                Adicionar animais
              </button>
            </div>
            <ul className="flex flex-col px-3 pb-3">
              {sel.animalIds.length === 0 && <li className="px-3 py-2.5 text-[15px] text-ink-muted">Nenhum animal neste grupo ainda.</li>}
              {sel.animalIds
                .map((id) => porId.get(id))
                .filter((a): a is Animal => !!a)
                .sort((a, b) => rotuloAnimal(a).localeCompare(rotuloAnimal(b), "pt-BR", { numeric: true }))
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3.5 rounded-field px-3 py-2 hover:bg-detail">
                    <Link href={`/animais/${a.id}`} className="flex flex-1 items-baseline gap-2 text-[15px] text-ink no-underline hover:underline">
                      {a.numero && <span className="text-ink-muted tabular-nums">nº {a.numero}</span>}
                      <span className="font-semibold">{a.nome}</span>
                    </Link>
                    <span className="text-sm text-ink-soft tabular-nums">{a.pesoKg != null ? `${a.pesoKg.toLocaleString("pt-BR")} kg` : ""}</span>
                    <button
                      type="button"
                      onClick={() => tirar(sel, a.id)}
                      className={buttonClass("linhaPerigo")}
                    >
                      Tirar do grupo
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      )}

      {(modal === "novo" || (modal === "editar" && sel)) && (
        <GrupoModal
          orgId={orgId}
          grupo={modal === "editar" ? sel! : null}
          possoRemover={possoRemover}
          onClose={() => setModal(null)}
          onDone={(id) => {
            setModal(null);
            setSelId(id ?? null);
            router.refresh();
          }}
        />
      )}
      {modal === "membro" && sel && (
        <MembroModal
          orgId={orgId}
          grupo={sel}
          animais={animais.filter((a) => !sel.animalIds.includes(a.id) && a.status === "ativo")}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
