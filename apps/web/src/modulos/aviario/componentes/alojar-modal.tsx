"use client";

import { criarLoteSchema, FASES_LOTE, ROTULO_FASE_LOTE, type Instalacao } from "@vocare/shared";
import { useState, useTransition, type FormEvent } from "react";

import { Button, Field, FormMessage, Input, Modal, ModalFooter, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { hojeISO } from "@/lib/datas";

type Linha = { chave: number; instalacaoId: string; femeas: string; machos: string };

function inteiro(v: string): number {
  return v.trim() === "" ? 0 : Number(v);
}

/** Aloja um lote: dados do lote e as aves de cada galpão livre. */
export function AlojarModal({
  orgId,
  instalacoes,
  onClose,
  onDone,
}: {
  orgId: string;
  instalacoes: Instalacao[];
  onClose: () => void;
  onDone: () => void;
}) {
  const livres = instalacoes.filter((i) => i.ativa && !i.loteAtual);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([{ chave: 0, instalacaoId: livres[0]?.id ?? "", femeas: "", machos: "" }]);

  function mudar(chave: number, campo: keyof Omit<Linha, "chave">, valor: string) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  }

  function adicionar() {
    const usados = new Set(linhas.map((l) => l.instalacaoId));
    const proximo = livres.find((i) => !usados.has(i.id));
    setLinhas((ls) => [...ls, { chave: Math.max(...ls.map((l) => l.chave)) + 1, instalacaoId: proximo?.id ?? "", femeas: "", machos: "" }]);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const linhagem = String(form.get("linhagem") ?? "").trim();
    // Confere antes do Zod: as mensagens dele para campo vazio ou inválido vêm em inglês.
    if (linhas.some((l) => !l.instalacaoId)) return setErro("Escolha o galpão.");
    const numeros = [String(form.get("idadeAlojamentoDias") ?? ""), ...linhas.flatMap((l) => [l.femeas, l.machos])];
    if (numeros.some((n) => n.trim() !== "" && !Number.isInteger(Number(n)))) return setErro("Informe um número inteiro.");
    if (!String(form.get("codigo") ?? "").trim()) return setErro("Informe o código do lote.");
    if (!form.get("dataAlojamento")) return setErro("Informe a data do alojamento.");
    const parsed = criarLoteSchema.safeParse({
      codigo: form.get("codigo"),
      especie: "ave",
      linhagem: linhagem || null,
      dataAlojamento: form.get("dataAlojamento"),
      idadeAlojamentoDias: inteiro(String(form.get("idadeAlojamentoDias") ?? "")),
      fase: form.get("fase"),
      galpoes: linhas.map((l) => ({ instalacaoId: l.instalacaoId, femeas: inteiro(l.femeas), machos: inteiro(l.machos) })),
    });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    if (new Set(linhas.map((l) => l.instalacaoId)).size !== linhas.length) return setErro("Cada galpão só pode aparecer uma vez.");

    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/lotes`, { method: "POST", body: JSON.stringify(parsed.data) });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title="Alojar lote" subtitle="Informe o lote e quantas aves foram para cada galpão." wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Código">
            <Input name="codigo" placeholder="Ex.: L-01" autoComplete="off" autoFocus />
          </Field>
          <Field label="Linhagem" hint="(opcional)">
            <Input name="linhagem" placeholder="Ex.: Cobb 500" />
          </Field>
          <Field label="Data do alojamento">
            <Input name="dataAlojamento" type="date" defaultValue={hojeISO()} />
          </Field>
          <Field label="Idade ao alojar (dias)">
            <Input name="idadeAlojamentoDias" type="number" min={0} inputMode="numeric" defaultValue={0} />
          </Field>
          <Field label="Fase">
            <Select name="fase" defaultValue="recria">
              {FASES_LOTE.map((f) => (
                <option key={f} value={f}>
                  {ROTULO_FASE_LOTE[f]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-ink">Galpões</legend>
          {livres.length === 0 && <p className="text-sm text-ink-muted">Não há galpão livre. Cadastre um em Configurações, Galpões, ou encerre um lote.</p>}
          {linhas.map((l, i) => (
            <div key={l.chave} className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
              <Field label={i === 0 ? "Galpão" : <span className="sr-only">Galpão</span>}>
                <Select value={l.instalacaoId} onChange={(e) => mudar(l.chave, "instalacaoId", e.target.value)}>
                  <option value="">Escolha o galpão</option>
                  {livres.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={i === 0 ? "Fêmeas" : <span className="sr-only">Fêmeas</span>}>
                <Input type="number" min={0} inputMode="numeric" value={l.femeas} onChange={(e) => mudar(l.chave, "femeas", e.target.value)} placeholder="0" />
              </Field>
              <Field label={i === 0 ? "Machos" : <span className="sr-only">Machos</span>}>
                <Input type="number" min={0} inputMode="numeric" value={l.machos} onChange={(e) => mudar(l.chave, "machos", e.target.value)} placeholder="0" />
              </Field>
              {linhas.length > 1 ? (
                <Button variant="fantasma" onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}>
                  Remover
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>
          ))}
          {linhas.length < livres.length && (
            <div>
              <Button variant="fantasma" onClick={adicionar}>
                Adicionar galpão
              </Button>
            </div>
          )}
        </fieldset>

        {erro && <FormMessage>{erro}</FormMessage>}

        <ModalFooter>
          <Button variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primario" loading={pending} disabled={livres.length === 0}>
            Alojar lote
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
