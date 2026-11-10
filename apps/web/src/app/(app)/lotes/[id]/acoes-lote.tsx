"use client";

import {
  encerrarLoteSchema,
  FASES_LOTE,
  faseLoteSchema,
  pesagemLoteInputSchema,
  ROTULO_FASE_LOTE,
  ROTULO_SEXO,
  transferirLoteSchema,
  vacinacaoLoteInputSchema,
  type FichaLote,
  type Instalacao,
} from "@vocare/shared";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Button, ConfirmBar, Field, FormMessage, Input, Modal, ModalFooter, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { hojeISO } from "@/lib/datas";

import { numeroPtBr } from "./apontamento-modal";

type Base = { orgId: string; loteId: string; onClose: () => void; onDone: () => void };

const inteiro = (v: FormDataEntryValue | null) => numeroPtBr(v) ?? 0;
const texto = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

/** Casca comum: formulário, erro, rodapé e a chamada à api. `montar` devolve o corpo ou a mensagem de erro. */
function ModalAcao({
  orgId,
  loteId,
  rota,
  titulo,
  subtitulo,
  confirmar,
  montar,
  onClose,
  onDone,
  children,
}: Base & {
  rota: string;
  titulo: string;
  subtitulo?: string;
  confirmar: string;
  montar: (form: FormData) => { corpo: unknown } | { erro: string };
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const r = montar(new FormData(e.currentTarget));
    if ("erro" in r) return setErro(r.erro);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/lotes/${loteId}/${rota}`, { method: "POST", body: JSON.stringify(r.corpo) });
      if (err) return setErro(err);
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title={titulo} subtitle={subtitulo}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {children}
        {erro && <FormMessage>{erro}</FormMessage>}
        <ModalFooter>
          <Button variant="fantasma" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primario" loading={pending}>
            {confirmar}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

const primeiroErro = (e: { issues: { message: string }[] }) => ({ erro: e.issues[0]?.message ?? "Dados inválidos." });

/** Aves vivas hoje no galpão: o que entrou menos as baixas apontadas desde a entrada. */
function vivasNoGalpao(ficha: FichaLote, instalacaoId: string) {
  const aloj = ficha.alojamentos.find((a) => a.instalacaoId === instalacaoId && a.fim === null);
  if (!aloj) return { femeas: 0, machos: 0 };
  let femeas = aloj.femeas;
  let machos = aloj.machos;
  for (const d of ficha.diario) {
    if (d.instalacaoId !== instalacaoId || d.data < aloj.inicio) continue;
    femeas -= (d.valores.mortasFemeas ?? 0) + (d.valores.eliminadasFemeas ?? 0);
    machos -= (d.valores.mortasMachos ?? 0) + (d.valores.eliminadasMachos ?? 0);
  }
  return { femeas: Math.max(0, femeas), machos: Math.max(0, machos) };
}

export function TransferirModal({ ficha, instalacoes, ...base }: Base & { ficha: FichaLote; instalacoes: Instalacao[] }) {
  const origens = ficha.lote.galpoes;
  const livres = instalacoes.filter((i) => i.ativa && !i.loteAtual);
  const [de, setDe] = useState(origens[0]?.id ?? "");
  const vivas = vivasNoGalpao(ficha, de);
  return (
    <ModalAcao
      {...base}
      rota="transferir"
      titulo="Transferir aves"
      subtitulo="Passa todas as aves do galpão de origem para um galpão livre."
      confirmar="Transferir"
      montar={(f) => {
        const p = transferirLoteSchema.safeParse({
          data: f.get("data"),
          de: f.get("de"),
          para: f.get("para"),
          femeas: inteiro(f.get("femeas")),
          machos: inteiro(f.get("machos")),
        });
        if (!p.success) return primeiroErro(p.error);
        if (p.data.de === p.data.para) return { erro: "Escolha um galpão de destino diferente do de origem." };
        if (p.data.femeas + p.data.machos === 0) return { erro: "Informe quantas aves vão passar." };
        return { corpo: p.data };
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="data" type="date" defaultValue={hojeISO()} />
        </Field>
        <span className="hidden sm:block" />
        <Field label="De">
          <Select name="de" value={de} onChange={(e) => setDe(e.target.value)}>
            {origens.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Para">
          <Select name="para" defaultValue="">
            <option value="">Escolha o galpão</option>
            {livres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fêmeas">
          <Input key={`f-${de}`} name="femeas" inputMode="numeric" defaultValue={String(vivas.femeas)} />
        </Field>
        <Field label="Machos">
          <Input key={`m-${de}`} name="machos" inputMode="numeric" defaultValue={String(vivas.machos)} />
        </Field>
      </div>
      <p className="text-sm text-ink-muted">
        A transferência move todas as aves do galpão e libera o galpão de origem. Confira os números: não podem passar das aves vivas.
      </p>
      {livres.length === 0 && <p className="text-sm text-ink-muted">Não há galpão livre. Cadastre um em Configurações, Galpões.</p>}
    </ModalAcao>
  );
}

export function FaseModal({ ficha, ...base }: Base & { ficha: FichaLote }) {
  return (
    <ModalAcao
      {...base}
      rota="fase"
      titulo="Mudar a fase"
      subtitulo="A fase muda a leitura dos indicadores do lote."
      confirmar="Salvar"
      montar={(f) => {
        const p = faseLoteSchema.safeParse({ fase: f.get("fase") });
        return p.success ? { corpo: p.data } : primeiroErro(p.error);
      }}
    >
      <Field label="Fase">
        <Select name="fase" defaultValue={ficha.lote.fase}>
          {FASES_LOTE.map((f) => (
            <option key={f} value={f}>
              {ROTULO_FASE_LOTE[f]}
            </option>
          ))}
        </Select>
      </Field>
    </ModalAcao>
  );
}

/** Encerrar não tem volta pela tela: pede data e confirmação na barra de perigo. */
export function EncerrarModal({ orgId, loteId, onClose, onDone }: Base) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [data, setData] = useState(hojeISO());
  const [confirmando, setConfirmando] = useState(false);

  function encerrar() {
    const p = encerrarLoteSchema.safeParse({ data });
    if (!p.success) return setErro(p.error.issues[0]?.message ?? "Data inválida.");
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/lotes/${loteId}/encerrar`, { method: "POST", body: JSON.stringify(p.data) });
      if (err) {
        setConfirmando(false);
        return setErro(err);
      }
      onDone();
    });
  }

  return (
    <Modal open onClose={onClose} title="Encerrar lote" subtitle="Os galpões ficam livres e o lote sai da lista de ativos.">
      <div className="flex flex-col gap-4">
        <Field label="Data do encerramento">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        {erro && <FormMessage>{erro}</FormMessage>}
        {confirmando ? (
          <ConfirmBar onCancel={() => setConfirmando(false)} onConfirm={encerrar} confirmLabel="Encerrar" pending={pending}>
            Encerrar o lote em {data.slice(8, 10)}/{data.slice(5, 7)}?
          </ConfirmBar>
        ) : (
          <ModalFooter>
            <Button variant="fantasma" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="perigoSolido" onClick={() => setConfirmando(true)}>
              Encerrar lote
            </Button>
          </ModalFooter>
        )}
      </div>
    </Modal>
  );
}

export function PesagemModal({ ficha, ...base }: Base & { ficha: FichaLote }) {
  return (
    <ModalAcao
      {...base}
      rota="pesagens"
      titulo="Registrar pesagem"
      confirmar="Salvar"
      montar={(f) => {
        const p = pesagemLoteInputSchema.safeParse({
          data: f.get("data"),
          sexo: f.get("sexo"),
          pesoMedioG: numeroPtBr(f.get("pesoMedioG")),
          uniformidadePct: numeroPtBr(f.get("uniformidadePct")),
          amostra: numeroPtBr(f.get("amostra")),
          instalacaoId: texto(f.get("instalacaoId")),
        });
        return p.success ? { corpo: p.data } : primeiroErro(p.error);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="data" type="date" defaultValue={hojeISO()} />
        </Field>
        <Field label="Sexo">
          <Select name="sexo" defaultValue="femea">
            <option value="femea">{ROTULO_SEXO.femea}</option>
            <option value="macho">{ROTULO_SEXO.macho}</option>
          </Select>
        </Field>
        <Field label="Peso médio (g)">
          <Input name="pesoMedioG" inputMode="decimal" autoComplete="off" />
        </Field>
        <Field label="Uniformidade (%)" hint="(opcional)">
          <Input name="uniformidadePct" inputMode="decimal" autoComplete="off" />
        </Field>
        <Field label="Aves pesadas" hint="(opcional)">
          <Input name="amostra" inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Galpão" hint="(opcional)">
          <Select name="instalacaoId" defaultValue="">
            <option value="">Todos</option>
            {ficha.lote.galpoes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </ModalAcao>
  );
}

export function VacinaModal(base: Base) {
  return (
    <ModalAcao
      {...base}
      rota="vacinacoes"
      titulo="Registrar vacina"
      confirmar="Salvar"
      montar={(f) => {
        const p = vacinacaoLoteInputSchema.safeParse({
          data: f.get("data"),
          vacina: f.get("vacina"),
          via: texto(f.get("via")),
          proximaData: texto(f.get("proximaData")),
        });
        return p.success ? { corpo: p.data } : primeiroErro(p.error);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="data" type="date" defaultValue={hojeISO()} />
        </Field>
        <Field label="Vacina">
          <Input name="vacina" autoComplete="off" autoFocus />
        </Field>
        <Field label="Via" hint="(opcional)">
          <Input name="via" placeholder="Ex.: água, ocular" autoComplete="off" />
        </Field>
        <Field label="Próxima dose" hint="(opcional)">
          <Input name="proximaData" type="date" />
        </Field>
      </div>
    </ModalAcao>
  );
}
