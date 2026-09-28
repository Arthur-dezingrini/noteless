"use client";

import { ESPECIES, ROTULO_ESPECIE, rotuloAnimal, type Animal, type Especie, type Grupo } from "@vocare/shared";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Modal } from "@/components/app/modal";
import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { chamarApi, chamarApiJson } from "@/lib/api-client";
import { BRAND_NAME } from "@/lib/brand";

const MISTURADO = "misturado";

function rotuloEspecie(e: string | null | undefined) {
  if (!e) return null;
  return e === MISTURADO ? "Misturado" : (ROTULO_ESPECIE[e as Especie] ?? e);
}

/** Corpo do PATCH/POST: o grupo inteiro, com a lista final de membros. */
function corpo(g: Pick<Grupo, "nome" | "descricao" | "especie" | "local">, animalIds: string[]) {
  return JSON.stringify({ nome: g.nome, descricao: g.descricao ?? null, especie: g.especie ?? null, local: g.local ?? null, animalIds });
}

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Grupos</h1>
          <p className="max-w-3xl text-base text-pretty text-ink-muted">
            Junte animais que recebem o mesmo cuidado. Quando alguém falar o nome do grupo no microfone do {BRAND_NAME}, o registro vai para
            todos.
          </p>
        </div>
        <button type="button" onClick={() => setModal("novo")} className={btn.secundario}>
          Criar grupo
        </button>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}

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
                  className={`flex w-full cursor-pointer flex-col gap-[3px] rounded-field px-3.5 py-3 text-left ${g.id === sel.id ? "bg-surface" : "hover:bg-hover"}`}
                >
                  <span className="text-[15px] font-semibold text-ink">{g.nome}</span>
                  <span className="text-sm text-ink-muted">
                    {[`${g.animalIds.length} ${g.animalIds.length === 1 ? "animal" : "animais"}`, rotuloEspecie(g.especie)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <section aria-label={sel.nome} className="flex min-w-0 flex-[999_1_28rem] flex-col rounded-card border border-line bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-[22px]">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-ink">{sel.nome}</h2>
                <p className="text-[15px] text-ink-muted">{[rotuloEspecie(sel.especie), sel.local].filter(Boolean).join(" · ") || "Sem espécie ou local"}</p>
              </div>
              <button type="button" onClick={() => setModal("editar")} className="h-10 cursor-pointer rounded-field px-3 text-[15px] font-semibold text-ink hover:bg-hover">
                Editar
              </button>
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
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-danger hover:bg-danger-bg"
                    >
                      Tirar do grupo
                    </button>
                  </li>
                ))}
            </ul>
          </section>
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

function Campo({ label, children, largo }: { label: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${largo ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

function Rodape({ children }: { children: ReactNode }) {
  return <div className="-mx-6 -mb-6 flex items-center justify-between gap-2 border-t border-line px-6 py-4">{children}</div>;
}

function GrupoModal({
  orgId,
  grupo,
  possoRemover,
  onClose,
  onDone,
}: {
  orgId: string;
  grupo: Grupo | null;
  possoRemover: boolean;
  onClose: () => void;
  onDone: (id?: string) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const dados = {
      nome: String(f.get("nome") ?? "").trim(),
      descricao: grupo?.descricao ?? null,
      especie: String(f.get("especie") || "") || null,
      local: String(f.get("local") ?? "").trim() || null,
    };
    if (dados.nome.length < 2) return setErro("Informe o nome do grupo.");
    setErro(null);
    start(async () => {
      const r = await chamarApiJson<{ id: string }>(grupo ? `/api/org/${orgId}/grupos/${grupo.id}` : `/api/org/${orgId}/grupos`, {
        method: grupo ? "PATCH" : "POST",
        body: corpo(dados, grupo?.animalIds ?? []),
      });
      if (!r.ok) return setErro(r.error);
      onDone(r.data.id);
    });
  }

  function remover() {
    if (!grupo) return;
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/grupos/${grupo.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={grupo ? "Editar grupo" : "Criar grupo"}
      subtitle={grupo ? "O nome é o que se fala no microfone." : "Depois é só falar o nome do grupo no microfone."}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome do grupo" largo>
            <input name="nome" className={campo} defaultValue={grupo?.nome ?? ""} placeholder="Ex.: Lote 5, Bezerros, Cães da casa" autoFocus required />
          </Campo>
          <Campo label="Espécie">
            <Select name="especie" defaultValue={grupo?.especie ?? ""}>
              <option value="">Não informada</option>
              {ESPECIES.map((e) => (
                <option key={e} value={e}>
                  {ROTULO_ESPECIE[e]}
                </option>
              ))}
              <option value={MISTURADO}>Misturado</option>
            </Select>
          </Campo>
          <Campo label="Onde fica">
            <input name="local" className={campo} defaultValue={grupo?.local ?? ""} placeholder="Ex.: Pasto de cima" />
          </Campo>
        </div>
        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
        {confirmar && grupo && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-[#efd3cc] bg-danger-bg px-4 py-3 text-[15px] text-ink">
            <span>Remover o grupo {grupo.nome}? Os animais continuam cadastrados.</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirmar(false)} className={btn.secundario}>
                Não
              </button>
              <button type="button" onClick={remover} disabled={pending} className={btn.perigoSolido}>
                Remover
              </button>
            </span>
          </div>
        )}
        <Rodape>
          {grupo && possoRemover && !confirmar ? (
            <button type="button" onClick={() => setConfirmar(true)} className={btn.perigo}>
              Remover grupo
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-field px-3.5 text-[15px] font-semibold text-ink hover:bg-hover">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btn.primario}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {grupo ? "Salvar" : "Criar grupo"}
            </button>
          </div>
        </Rodape>
      </form>
    </Modal>
  );
}

/** "Adicionar animais": marca quantos quiser de uma vez. */
function MembroModal({
  orgId,
  grupo,
  animais,
  onClose,
  onDone,
}: {
  orgId: string;
  grupo: Grupo;
  animais: Animal[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const visiveis = animais.filter((a) => !termo || rotuloAnimal(a).toLowerCase().includes(termo));

  function salvar() {
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/grupos/${grupo.id}`, {
        method: "PATCH",
        body: corpo(grupo, [...grupo.animalIds, ...marcados]),
      });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title="Adicionar animais ao grupo" subtitle="Um animal pode estar em mais de um grupo.">
      <div className="flex flex-col gap-3">
        {animais.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Todos os animais ativos já estão neste grupo.</p>
        ) : (
          <>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou número"
              aria-label="Buscar animal"
              className={campo}
              autoFocus
            />
            <ul className="-mx-2 flex max-h-72 flex-col overflow-y-auto">
              {visiveis.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-field px-2 py-2 text-[15px] hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={marcados.has(a.id)}
                      onChange={() =>
                        setMarcados((s) => {
                          const n = new Set(s);
                          if (n.has(a.id)) n.delete(a.id);
                          else n.add(a.id);
                          return n;
                        })
                      }
                      className="size-[18px] accent-brand"
                    />
                    <span className="flex-1 text-ink">{rotuloAnimal(a)}</span>
                    <span className="text-sm text-ink-muted">{ROTULO_ESPECIE[a.especie]}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}
        <Rodape>
          <span className="text-sm text-ink-muted">{marcados.size ? `${marcados.size} marcados` : ""}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-field px-3.5 text-[15px] font-semibold text-ink hover:bg-hover">
              Cancelar
            </button>
            <button type="button" onClick={salvar} disabled={pending || marcados.size === 0} className={btn.primario}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Adicionar
            </button>
          </div>
        </Rodape>
      </div>
    </Modal>
  );
}
