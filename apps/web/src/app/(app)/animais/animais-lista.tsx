"use client";

import { ESPECIES, ROTULO_ESPECIE, ROTULO_SEXO, type Animal, type Especie } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";

import { Button, Card, cx, EmptyState, Input, PageHeader, Select, StatusText, tabela, type Tom } from "@/components/ui";

import { AnimalModal } from "./animal-modal";

type Situacao = "ativo" | "tratamento" | "inativo";

function situacao(a: Animal): Situacao {
  if (a.status === "inativo") return "inativo";
  return a.emTratamento ? "tratamento" : "ativo";
}

const SITUACAO: Record<Situacao, { rotulo: string; tom: Tom }> = {
  ativo: { rotulo: "Ativo", tom: "ok" },
  tratamento: { rotulo: "Em tratamento", tom: "aviso" },
  inativo: { rotulo: "Inativo", tom: "neutro" },
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
      <PageHeader
        title="Animais"
        description="Clique em um animal para ver o histórico completo."
        actions={<Button onClick={() => setModal({ animal: null })}>Cadastrar animal</Button>}
      />

      <div className="flex flex-wrap gap-2.5">
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou número"
          aria-label="Buscar animal por nome ou número"
          className="h-[42px] max-w-[400px] flex-[1_1_15rem]"
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

      <Card className="overflow-hidden">
        <table className={tabela.table}>
          <thead className={tabela.thead}>
            <tr>
              <th className={tabela.th}>Animal</th>
              <th className={cx(tabela.th, "hidden md:table-cell")}>Espécie e raça</th>
              <th className={cx(tabela.th, "hidden w-24 xl:table-cell")}>Sexo</th>
              <th className={cx(tabela.th, "hidden w-24 md:table-cell")}>Peso</th>
              <th className={cx(tabela.th, "hidden xl:table-cell")}>Onde fica</th>
              <th className={cx(tabela.th, "hidden w-28 xl:table-cell")}>Última visita</th>
              <th className={cx(tabela.th, "w-32")}>Situação</th>
              <th className="w-12 px-3 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => {
              const s = SITUACAO[situacao(a)];
              return (
                <tr
                  key={a.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Abrir ficha de ${a.nome || `nº ${a.numero}`}`}
                  onClick={() => abrir(a)}
                  onKeyDown={(e) => teclas(e, a)}
                  className={tabela.linhaClicavel}
                >
                  <td className={tabela.td}>
                    <span className="flex min-w-0 items-baseline gap-2">
                      {a.numero && <span className="shrink-0 text-ink-muted tabular-nums">nº {a.numero}</span>}
                      <span className="truncate font-semibold text-ink">{a.nome || (a.numero ? "" : "Sem nome")}</span>
                    </span>
                    <span className="block truncate text-sm text-ink-muted md:hidden">
                      {ROTULO_ESPECIE[a.especie]} · {peso(a.pesoKg)}
                    </span>
                  </td>
                  <td className={cx(tabela.td, "hidden truncate text-ink-soft md:table-cell")}>
                    {[ROTULO_ESPECIE[a.especie], a.raca].filter(Boolean).join(" · ")}
                  </td>
                  <td className={cx(tabela.td, "hidden text-ink-soft xl:table-cell")}>{a.sexo ? ROTULO_SEXO[a.sexo] : "—"}</td>
                  <td className={cx(tabela.td, "hidden text-ink tabular-nums md:table-cell")}>{peso(a.pesoKg)}</td>
                  <td className={cx(tabela.td, "hidden truncate text-ink-soft xl:table-cell")}>{a.local || "—"}</td>
                  <td className={cx(tabela.td, "hidden text-ink-soft tabular-nums xl:table-cell")}>{diaMes(a.ultimaVisita)}</td>
                  <td className={tabela.td}>
                    <StatusText tone={s.tom}>{s.rotulo}</StatusText>
                  </td>
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
          <EmptyState
            title={animais.length === 0 ? "Nenhum animal cadastrado ainda" : "Nenhum animal encontrado"}
            description={
              animais.length === 0
                ? "Cadastre aqui ou fale no microfone: “nasceu um bezerro, número 132”."
                : "Confira o nome ou o número, ou limpe os filtros."
            }
          />
        )}
      </Card>
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
