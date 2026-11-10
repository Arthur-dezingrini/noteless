"use client";

import {
  criarInstalacaoSchema,
  editarInstalacaoSchema,
  ROTULO_TIPO_INSTALACAO,
  TIPOS_INSTALACAO,
  type Instalacao,
} from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button, buttonClass, Card, cx, Field, FormMessage, Input, Modal, Select, tabela } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";

type Props = {
  orgId: string;
  instalacoes: Instalacao[];
  possoGerenciar: boolean;
};

/** Campo numérico opcional: vazio vira `null` (limpa o valor ao editar). */
function numeroOuNulo(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim().replace(",", ".");
  if (!texto) return null;
  const n = Number(texto);
  return Number.isNaN(n) ? Number.NaN : n;
}

export function GalpoesLista({ orgId, instalacoes, possoGerenciar }: Props) {
  const router = useRouter();
  const [cadastrando, setCadastrando] = useState(false);
  const [editando, setEditando] = useState<Instalacao | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-ink-soft">
            {instalacoes.length} {instalacoes.length === 1 ? "galpão cadastrado" : "galpões cadastrados"}
          </p>
          {possoGerenciar && (
            <Button variant="primario" onClick={() => setCadastrando(true)}>
              Cadastrar galpão
            </Button>
          )}
        </div>

        {instalacoes.length === 0 ? (
          <Card padded className="text-sm text-ink-muted">
            Nenhum galpão cadastrado ainda. Cadastrar o primeiro libera o item Lotes no menu.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <table className={tabela.table}>
              <thead className={tabela.thead}>
                <tr>
                  <th className={tabela.th}>Nome</th>
                  <th className={cx(tabela.th, "hidden w-28 md:table-cell")}>Tipo</th>
                  <th className={cx(tabela.th, "hidden w-28 md:table-cell")}>Capacidade</th>
                  <th className={cx(tabela.th, "hidden w-28 xl:table-cell")}>Área (m²)</th>
                  <th className={tabela.th}>Lote atual</th>
                  {possoGerenciar && (
                    <th className="w-20 px-3 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {instalacoes.map((i) => (
                  <tr key={i.id} className={tabela.linha}>
                    <td className={tabela.td}>
                      <span className="block truncate font-semibold text-ink">{i.nome}</span>
                      {!i.ativa && <span className="block text-sm text-ink-muted">Inativa</span>}
                    </td>
                    <td className={cx(tabela.td, "hidden md:table-cell")}>{ROTULO_TIPO_INSTALACAO[i.tipo]}</td>
                    <td className={cx(tabela.td, "hidden tabular-nums md:table-cell")}>{i.capacidade ?? "—"}</td>
                    <td className={cx(tabela.td, "hidden tabular-nums xl:table-cell")}>{i.areaM2 ?? "—"}</td>
                    <td className={tabela.td}>{i.loteAtual ? i.loteAtual.codigo : <span className="text-ink-muted">Livre</span>}</td>
                    {possoGerenciar && (
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => setEditando(i)} className={buttonClass("linha")}>
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {feedback && (
        <FormMessage tone="ok" className="mt-4">
          {feedback}
        </FormMessage>
      )}

      <GalpaoModal
        open={cadastrando}
        orgId={orgId}
        onClose={() => setCadastrando(false)}
        onDone={() => {
          setCadastrando(false);
          setFeedback("Galpão cadastrado com sucesso.");
          router.refresh();
        }}
      />

      <GalpaoModal
        open={editando !== null}
        orgId={orgId}
        instalacao={editando}
        onClose={() => setEditando(null)}
        onDone={() => {
          setEditando(null);
          setFeedback("Galpão atualizado com sucesso.");
          router.refresh();
        }}
      />
    </>
  );
}

/** Cadastro (sem `instalacao`) e edição (com) compartilham o formulário. */
function GalpaoModal({
  open,
  orgId,
  instalacao,
  onClose,
  onDone,
}: {
  open: boolean;
  orgId: string;
  instalacao?: Instalacao | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const edicao = instalacao != null;

  function fechar() {
    setErro(null);
    onClose();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const dados = {
      nome: form.get("nome"),
      tipo: form.get("tipo"),
      capacidade: numeroOuNulo(form.get("capacidade")),
      areaM2: numeroOuNulo(form.get("areaM2")),
    };
    if (Number.isNaN(dados.capacidade) || Number.isNaN(dados.areaM2)) {
      setErro("Informe um número válido.");
      return;
    }
    const parsed = edicao
      ? editarInstalacaoSchema.safeParse({ ...dados, ativa: form.get("ativa") === "sim" })
      : criarInstalacaoSchema.safeParse(dados);
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    const formEl = e.currentTarget;
    start(async () => {
      const err = await chamarApi(
        edicao ? `/api/org/${orgId}/instalacoes/${instalacao.id}` : `/api/org/${orgId}/instalacoes`,
        { method: edicao ? "PATCH" : "POST", body: JSON.stringify(parsed.data) },
      );
      if (err) return setErro(err);
      if (!edicao) formEl.reset();
      onDone();
    });
  }

  return (
    <Modal open={open} onClose={fechar} title={edicao ? "Editar galpão" : "Cadastrar galpão"}>
      {(!edicao || instalacao) && (
        <form key={instalacao?.id ?? "novo"} onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <Input name="nome" defaultValue={instalacao?.nome ?? ""} required maxLength={60} placeholder="Galpão 1" autoComplete="off" />
          </Field>
          <Field label="Tipo">
            <Select name="tipo" defaultValue={instalacao?.tipo ?? "galpao"}>
              {TIPOS_INSTALACAO.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_INSTALACAO[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Capacidade (animais)">
            <Input name="capacidade" inputMode="numeric" defaultValue={instalacao?.capacidade ?? ""} placeholder="Opcional" />
          </Field>
          <Field label="Área (m²)">
            <Input name="areaM2" inputMode="decimal" defaultValue={instalacao?.areaM2 ?? ""} placeholder="Opcional" />
          </Field>
          {edicao && (
            <Field label="Situação">
              <Select name="ativa" defaultValue={instalacao.ativa ? "sim" : "nao"}>
                <option value="sim">Ativa</option>
                <option value="nao">Inativa</option>
              </Select>
            </Field>
          )}

          {erro && <FormMessage>{erro}</FormMessage>}

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={fechar}>Cancelar</Button>
            <Button type="submit" variant="primario" loading={pending}>
              {edicao ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
