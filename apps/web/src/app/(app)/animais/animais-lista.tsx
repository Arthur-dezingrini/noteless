"use client";

import { ESPECIES, ROTULO_ESPECIE, ROTULO_SEXO, type Animal, type Especie } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";

import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";

import { AnimalModal } from "./animal-modal";

type Situacao = "ativo" | "tratamento" | "inativo";

function situacao(a: Animal): Situacao {
  if (a.status === "inativo") return "inativo";
  return a.emTratamento ? "tratamento" : "ativo";
}

const SITUACAO: Record<Situacao, { rotulo: string; cor: string }> = {
  ativo: { rotulo: "Ativo", cor: "text-brand-ink" },
  tratamento: { rotulo: "Em tratamento", cor: "text-warn" },
  inativo: { rotulo: "Inativo", cor: "text-ink-muted" },
};

function peso(kg: number | null | undefined) {
  return kg == null ? "—" : `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

/** "AAAA-MM-DD" → "DD/MM". */
function diaMes(iso: string | null | undefined) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—";
}

type Props = { orgId: string; animais: Animal[]; possoRemover: boolean };

export function AnimaisLista({ orgId, animais, possoRemover }: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [especie, setEspecie] = useState<Especie | "">("");
  const [filtroSituacao, setFiltroSituacao] = useState<Situacao | "">("");
  const [modal, setModal] = useState<{ animal: Animal | null } | null>(null);

  // Só as espécies que a conta tem, para o filtro não virar lista de zoológico.
  const especiesNaConta = ESPECIES.filter((e) => animais.some((a) => a.especie === e));

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return animais.filter((a) => {
      if (especie && a.especie !== especie) return false;
      if (filtroSituacao && situacao(a) !== filtroSituacao) return false;
      if (!termo) return true;
      return [a.nome, a.numero, a.microchip].some((v) => v?.toLowerCase().includes(termo));
    });
  }, [animais, busca, especie, filtroSituacao]);

  function abrir(a: Animal) {
    router.push(`/animais/${a.id}`);
  }

  function teclas(e: KeyboardEvent, a: Animal) {
    if (e.key === "Enter") abrir(a);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Animais</h1>
          <p className="text-base text-ink-muted">Clique em um animal para ver o histórico completo.</p>
        </div>
        <button type="button" onClick={() => setModal({ animal: null })} className={btn.secundario}>
          Cadastrar animal
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou número"
          aria-label="Buscar animal por nome ou número"
          className={`${campo} h-[42px] max-w-[400px] flex-[1_1_15rem]`}
        />
        <Select value={especie} onChange={(e) => setEspecie(e.target.value as Especie | "")} aria-label="Espécie" className="w-48">
          <option value="">Todas as espécies</option>
          {especiesNaConta.map((e) => (
            <option key={e} value={e}>
              {ROTULO_ESPECIE[e]}
            </option>
          ))}
        </Select>
        <Select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value as Situacao | "")} aria-label="Situação" className="w-48">
          <option value="">Qualquer situação</option>
          {(Object.keys(SITUACAO) as Situacao[]).map((s) => (
            <option key={s} value={s}>
              {SITUACAO[s].rotulo}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full table-fixed text-left text-[15px]">
          <thead className="border-b border-line bg-detail text-[13px] font-semibold text-ink-muted">
            <tr>
              <th className="px-[18px] py-3 font-semibold">Animal</th>
              <th className="hidden px-3 py-3 font-semibold md:table-cell">Espécie e raça</th>
              <th className="hidden w-24 px-3 py-3 font-semibold xl:table-cell">Sexo</th>
              <th className="hidden w-24 px-3 py-3 font-semibold md:table-cell">Peso</th>
              <th className="hidden px-3 py-3 font-semibold xl:table-cell">Onde fica</th>
              <th className="hidden w-28 px-3 py-3 font-semibold xl:table-cell">Última visita</th>
              <th className="w-32 px-3 py-3 font-semibold">Situação</th>
              <th className="w-12 px-3 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a, i) => {
              const s = SITUACAO[situacao(a)];
              return (
                <tr
                  key={a.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Abrir ficha de ${a.nome || `nº ${a.numero}`}`}
                  onClick={() => abrir(a)}
                  onKeyDown={(e) => teclas(e, a)}
                  className={`cursor-pointer hover:bg-detail focus-visible:bg-detail focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${i ? "border-t border-line-soft" : ""}`}
                >
                  <td className="px-[18px] py-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      {a.numero && <span className="shrink-0 text-ink-muted tabular-nums">nº {a.numero}</span>}
                      <span className="truncate font-semibold text-ink">{a.nome || (a.numero ? "" : "Sem nome")}</span>
                    </span>
                    <span className="block truncate text-sm text-ink-muted md:hidden">
                      {ROTULO_ESPECIE[a.especie]} · {peso(a.pesoKg)}
                    </span>
                  </td>
                  <td className="hidden truncate px-3 py-3 text-ink-soft md:table-cell">
                    {[ROTULO_ESPECIE[a.especie], a.raca].filter(Boolean).join(" · ")}
                  </td>
                  <td className="hidden px-3 py-3 text-ink-soft xl:table-cell">{a.sexo ? ROTULO_SEXO[a.sexo] : "—"}</td>
                  <td className="hidden px-3 py-3 text-ink tabular-nums md:table-cell">{peso(a.pesoKg)}</td>
                  <td className="hidden truncate px-3 py-3 text-ink-soft xl:table-cell">{a.local || "—"}</td>
                  <td className="hidden px-3 py-3 text-ink-soft tabular-nums xl:table-cell">{diaMes(a.ultimaVisita)}</td>
                  <td className={`px-3 py-3 text-sm font-semibold ${s.cor}`}>{s.rotulo}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal({ animal: a });
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label={`Editar ${a.nome || `nº ${a.numero}`}`}
                      className="grid size-7 cursor-pointer place-items-center rounded-md text-lg leading-none text-ink-muted hover:bg-surface"
                    >
                      …
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div className="flex flex-col gap-1.5 p-9 text-center">
            <p className="text-base font-semibold text-ink">
              {animais.length === 0 ? "Nenhum animal cadastrado ainda" : "Nenhum animal encontrado"}
            </p>
            <p className="text-[15px] text-ink-muted">
              {animais.length === 0
                ? "Cadastre aqui ou fale no microfone: “nasceu um bezerro, número 132”."
                : "Confira o nome ou o número, ou limpe os filtros."}
            </p>
          </div>
        )}
      </div>
      {filtrados.length > 0 && (
        <p className="text-sm text-ink-muted">
          Mostrando {filtrados.length} de {animais.length} {animais.length === 1 ? "animal" : "animais"}
        </p>
      )}

      {modal && (
        <AnimalModal
          animal={modal.animal}
          orgId={orgId}
          possoRemover={possoRemover}
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
