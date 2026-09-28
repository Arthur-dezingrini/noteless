"use client";

import {
  atualizarAnimalSchema,
  criarAnimalSchema,
  ESPECIES,
  ROTULO_ESPECIE,
  ROTULO_SEXO,
  ROTULO_STATUS_ANIMAL,
  SEXOS,
  STATUS_ANIMAL,
  type Animal,
  type Especie,
  type StatusAnimal,
} from "@vocare/shared";
import { Loader2, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { Badge, type Tone } from "@/components/app/badge";
import { Card } from "@/components/app/card";
import { Modal } from "@/components/app/modal";
import { PageHeader } from "@/components/app/page-header";
import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { idade } from "@/lib/datas";

const inputClasses = campo;

const TOM_STATUS: Record<StatusAnimal, Tone> = { ativo: "green", inativo: "gray" };

type Props = {
  orgId: string;
  animais: Animal[];
  possoRemover: boolean;
};

/** Chamada à api pelo rewrite (/api/* → apps/api); o cookie vai junto. */
async function chamarApi(path: string, init: RequestInit): Promise<string | null> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Não foi possível concluir. Tente de novo.";
}

/** "AAAA-MM-DD" → "DD/MM/AAAA", sem passar por Date (sem fuso). */
function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function formatarPeso(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;
}

function Campo({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

export function AnimaisLista({ orgId, animais, possoRemover }: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [especie, setEspecie] = useState<Especie | "">("");
  const [status, setStatus] = useState<StatusAnimal | "">("");
  const [cadastrando, setCadastrando] = useState(false);
  const [editando, setEditando] = useState<Animal | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return animais.filter((a) => {
      if (especie && a.especie !== especie) return false;
      if (status && a.status !== status) return false;
      if (!termo) return true;
      return [a.nome, ROTULO_ESPECIE[a.especie], a.raca, a.tutor]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(termo));
    });
  }, [animais, busca, especie, status]);

  const total = animais.length;

  return (
    <>
      <PageHeader
        title="Animais"
        subtitle={`${total.toLocaleString("pt-BR")} ${total === 1 ? "animal cadastrado" : "animais cadastrados"}`}
        aside={
          <button
            type="button"
            onClick={() => setCadastrando(true)}
            className={btn.primario}
          >
            <Plus className="size-4" /> Cadastrar animal
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, espécie ou tutor..."
            aria-label="Buscar animal"
            className={`${inputClasses} pl-10`}
          />
        </label>
        <Select
          value={especie}
          onChange={(e) => setEspecie(e.target.value as Especie | "")}
          aria-label="Filtrar por espécie"
          className="sm:w-44"
        >
          <option value="">Todas espécies</option>
          {ESPECIES.map((e) => (
            <option key={e} value={e}>
              {ROTULO_ESPECIE[e]}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusAnimal | "")}
          aria-label="Filtrar por status"
          className="sm:w-40"
        >
          <option value="">Todos status</option>
          {STATUS_ANIMAL.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS_ANIMAL[s]}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-muted">
              <th className="px-5 py-3 font-medium">Animal</th>
              <th className="px-3 py-3 font-medium">Espécie / Raça</th>
              <th className="px-3 py-3 font-medium">Tutor</th>
              <th className="px-3 py-3 font-medium">Peso</th>
              <th className="px-3 py-3 font-medium">Última visita</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtrados.map((a) => {
              const anos = idade(a.nascimento);
              return (
                <tr key={a.id} className="transition hover:bg-surface/60">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand"
                      >
                        {a.nome[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/animais/${a.id}`} className="font-semibold text-ink hover:underline">
                          {a.nome}
                        </Link>
                        {anos && <p className="text-xs text-ink-muted">{anos}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <span className="text-sm text-ink-soft">{ROTULO_ESPECIE[a.especie]}</span>
                    {a.raca && <p className="mt-1 text-xs text-ink-muted">{a.raca}</p>}
                  </td>
                  <td className="px-3 py-4 text-ink">{a.tutor || "—"}</td>
                  <td className="px-3 py-4 text-ink tabular-nums">{formatarPeso(a.pesoKg)}</td>
                  <td className="px-3 py-4 text-ink-muted tabular-nums">{formatarData(a.ultimaVisita)}</td>
                  <td className="px-3 py-4">
                    <Badge tone={TOM_STATUS[a.status]}>{ROTULO_STATUS_ANIMAL[a.status]}</Badge>
                  </td>
                  <td className="px-3 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setEditando(a)}
                      aria-label={`Editar ${a.nome}`}
                      className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface hover:text-ink"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-ink-muted">
                  {total === 0
                    ? "Nenhum animal cadastrado ainda. Clique em “Cadastrar animal” para começar."
                    : "Nenhum animal encontrado com esses filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <AnimalModal
        key={editando?.id ?? "novo"}
        open={cadastrando || editando !== null}
        animal={editando}
        orgId={orgId}
        possoRemover={possoRemover}
        onClose={() => {
          setCadastrando(false);
          setEditando(null);
        }}
        onDone={() => {
          setCadastrando(false);
          setEditando(null);
          router.refresh();
        }}
      />
    </>
  );
}

/** Texto do formulário: vazio vira null, como o contrato espera. */
function texto(form: FormData, nome: string): string | null {
  const v = form.get(nome);
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Um modal só para cadastrar e editar — a diferença é ter `animal` ou não. */
function AnimalModal({
  open,
  animal,
  orgId,
  possoRemover,
  onClose,
  onDone,
}: {
  open: boolean;
  animal: Animal | null;
  orgId: string;
  possoRemover: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  function fechar() {
    setErro(null);
    setConfirmarRemocao(false);
    onClose();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const dados = {
      nome: form.get("nome"),
      especie: form.get("especie"),
      raca: texto(form, "raca"),
      sexo: texto(form, "sexo"),
      nascimento: texto(form, "nascimento"),
      pesoKg: texto(form, "pesoKg"),
      tutor: texto(form, "tutor"),
      tutorTelefone: texto(form, "tutorTelefone"),
      ultimaVisita: texto(form, "ultimaVisita"),
    };
    const parsed = animal
      ? atualizarAnimalSchema.safeParse({ ...dados, status: form.get("status") })
      : criarAnimalSchema.safeParse(dados);
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    const formEl = e.currentTarget;
    start(async () => {
      const err = await chamarApi(
        animal ? `/api/org/${orgId}/animais/${animal.id}` : `/api/org/${orgId}/animais`,
        { method: animal ? "PATCH" : "POST", body: JSON.stringify(parsed.data) },
      );
      if (err) return setErro(err);
      formEl.reset();
      onDone();
    });
  }

  function remover() {
    if (!animal) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/animais/${animal.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      setConfirmarRemocao(false);
      onDone();
    });
  }

  return (
    <Modal open={open} onClose={fechar} title={animal ? "Editar animal" : "Cadastrar animal"} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Nome">
            <input name="nome" className={inputClasses} defaultValue={animal?.nome} required autoComplete="off" autoFocus />
          </Campo>
          <Campo label="Espécie">
            <Select name="especie" defaultValue={animal?.especie ?? "cao"}>
              {ESPECIES.map((e) => (
                <option key={e} value={e}>
                  {ROTULO_ESPECIE[e]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Raça">
            <input name="raca" className={inputClasses} defaultValue={animal?.raca ?? ""} placeholder="Golden Retriever, Siamês, SRD…" />
          </Campo>
          <Campo label="Sexo">
            <Select name="sexo" defaultValue={animal?.sexo ?? ""}>
              <option value="">Não informado</option>
              {SEXOS.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SEXO[s]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Data de nascimento">
            <input name="nascimento" type="date" className={inputClasses} defaultValue={animal?.nascimento ?? ""} />
          </Campo>
          <Campo label="Peso (kg)">
            <input name="pesoKg" type="number" step="0.1" min="0" className={inputClasses} defaultValue={animal?.pesoKg ?? ""} placeholder="0,0" />
          </Campo>
          <Campo label="Tutor">
            <input name="tutor" className={inputClasses} defaultValue={animal?.tutor ?? ""} placeholder="Nome do responsável" />
          </Campo>
          <Campo label="Telefone do tutor">
            <input name="tutorTelefone" type="tel" className={inputClasses} defaultValue={animal?.tutorTelefone ?? ""} placeholder="(11) 99999-9999" />
          </Campo>
          <Campo label="Última visita">
            <input name="ultimaVisita" type="date" className={inputClasses} defaultValue={animal?.ultimaVisita ?? ""} />
          </Campo>
          {animal && (
            <Campo label="Status">
              <Select name="status" defaultValue={animal.status}>
                {STATUS_ANIMAL.map((s) => (
                  <option key={s} value={s}>
                    {ROTULO_STATUS_ANIMAL[s]}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
        </div>

        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}

        {confirmarRemocao && animal && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            <span>
              Remover <strong>{animal.nome}</strong> do cadastro? Isso não pode ser desfeito.
            </span>
            <span className="flex shrink-0 gap-3 text-xs font-semibold">
              <button type="button" onClick={remover} disabled={pending} className="text-red-700 hover:underline disabled:opacity-60">
                Sim, remover
              </button>
              <button type="button" onClick={() => setConfirmarRemocao(false)} className="text-ink-muted hover:underline">
                Não
              </button>
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {animal && possoRemover && !confirmarRemocao ? (
            <button type="button" onClick={() => setConfirmarRemocao(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline">
              <Trash2 className="size-3.5" /> Remover animal
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={fechar} className={btn.secundario}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btn.primario}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {animal ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
