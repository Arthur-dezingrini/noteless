"use client";

import {
  criarProntuarioSchema,
  MEDIDAS_EXAME,
  ROTULO_TIPO_CONSULTA,
  TIPOS_CONSULTA,
  rotuloAnimal,
  type Prontuario,
  type TipoConsulta,
} from "@vocare/shared";
import { Loader2, X } from "lucide-react";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Modal } from "@/components/app/modal";
import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { chamarApi, chamarApiJson } from "@/lib/api-client";

export type AnimalOpcao = { id: string; nome: string | null; numero: string | null };
export type Veterinario = { id: string; nome: string };

const EXEMPLO_MEDIDA: Record<(typeof MEDIDAS_EXAME)[number], string> = {
  FC: "72 bpm",
  FR: "24 mpm",
  Temperatura: "38,6 °C",
  Peso: "480 kg",
  TPC: "2 s",
};

function Campo({ label, dica, children, largo }: { label: string; dica?: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${largo ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-semibold text-ink">
        {label}
        {dica && <span className="font-normal text-ink-muted"> {dica}</span>}
      </span>
      {children}
    </label>
  );
}

type Par = { a: string; b: string };

/**
 * Lista de pares editável (remédio + como tomar, exame + resultado, medida
 * extra + valor). Linha vazia é ignorada ao salvar.
 */
function Pares({
  titulo,
  itens,
  onChange,
  rotuloA,
  rotuloB,
  exemploA,
  exemploB,
  adicionar,
}: {
  titulo: string;
  itens: Par[];
  onChange: (v: Par[]) => void;
  rotuloA: string;
  rotuloB: string;
  exemploA: string;
  exemploB: string;
  adicionar: string;
}) {
  const mudar = (i: number, m: Partial<Par>) => onChange(itens.map((x, j) => (j === i ? { ...x, ...m } : x)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-ink">{titulo}</legend>
      {itens.map((x, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            value={x.a}
            onChange={(e) => mudar(i, { a: e.target.value })}
            aria-label={`${rotuloA} ${i + 1}`}
            placeholder={exemploA}
            className={`${campo} min-w-0 flex-[1_1_10rem]`}
          />
          <input
            value={x.b}
            onChange={(e) => mudar(i, { b: e.target.value })}
            aria-label={`${rotuloB} ${i + 1}`}
            placeholder={exemploB}
            className={`${campo} min-w-0 flex-[2_1_14rem]`}
          />
          <button
            type="button"
            onClick={() => onChange(itens.filter((_, j) => j !== i))}
            aria-label={`Tirar ${rotuloA.toLowerCase()} ${i + 1}`}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-field text-ink-muted hover:bg-hover hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...itens, { a: "", b: "" }])} className={`${btn.link} w-fit text-sm`}>
        {adicionar}
      </button>
    </fieldset>
  );
}

const texto = (form: FormData, nome: string) => {
  const v = form.get(nome);
  return typeof v === "string" ? v.trim() : "";
};
const preenchidos = (l: Par[]) => l.map((x) => ({ a: x.a.trim(), b: x.b.trim() })).filter((x) => x.a);

/**
 * Registrar e corrigir atendimento. Vindo da agenda, já chega com animal,
 * data, tipo e veterinário da consulta.
 */
export function ProntuarioModal({
  orgId,
  prontuario: p,
  inicial,
  animais,
  veterinarios,
  podeApagar,
  onClose,
  onDone,
}: {
  orgId: string;
  prontuario: Prontuario | null;
  inicial?: { consultaId?: string; animalId: string; data: string; tipo: TipoConsulta; veterinarioId: string | null };
  animais: AnimalOpcao[];
  veterinarios: Veterinario[];
  podeApagar: boolean;
  onClose: () => void;
  onDone: (r?: { id?: string; removido?: boolean }) => void;
}) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const medidaFixa = (nome: string) => p?.exame.find((x) => x.nome === nome)?.valor ?? "";
  const [extras, setExtras] = useState<Par[]>(
    () => p?.exame.filter((x) => !(MEDIDAS_EXAME as readonly string[]).includes(x.nome)).map((x) => ({ a: x.nome, b: x.valor })) ?? [],
  );
  const [remedios, setRemedios] = useState<Par[]>(() => p?.remedios.map((x) => ({ a: x.nome, b: x.como })) ?? []);
  const [exames, setExames] = useState<Par[]>(() => p?.exames.map((x) => ({ a: x.nome, b: x.resultado })) ?? []);

  const consultaId = p ? p.consultaId : inicial?.consultaId;
  const animalFixo = !!consultaId;
  const animalInicial = p?.animalId ?? inicial?.animalId ?? "";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);

    const exame = [
      ...MEDIDAS_EXAME.map((nome) => ({ nome, valor: texto(form, `medida-${nome}`) })).filter((x) => x.valor),
      ...preenchidos(extras)
        .filter((x) => x.b)
        .map((x) => ({ nome: x.a, valor: x.b })),
    ];
    const retornoData = texto(form, "retornoData");
    const retornoHora = texto(form, "retornoHora");
    if (retornoData && !retornoHora) return setErro("Diga a hora do retorno.");

    const parsed = criarProntuarioSchema.safeParse({
      animalId: animalFixo ? animalInicial : texto(form, "animalId"),
      consultaId: consultaId ?? null,
      veterinarioId: texto(form, "veterinarioId") || null,
      data: texto(form, "data"),
      tipo: form.get("tipo"),
      queixa: texto(form, "queixa"),
      exame,
      diagnostico: texto(form, "diagnostico"),
      remedios: preenchidos(remedios).map((x) => ({ nome: x.a, como: x.b })),
      exames: preenchidos(exames).map((x) => ({ nome: x.a, resultado: x.b })),
      retorno: retornoData ? { data: retornoData, hora: retornoHora } : null,
    });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");

    start(async () => {
      if (p) {
        const err = await chamarApi(`/api/org/${orgId}/prontuarios/${p.id}`, { method: "PATCH", body: JSON.stringify(parsed.data) });
        if (err) return setErro(err);
        return onDone({ id: p.id });
      }
      const r = await chamarApiJson<{ id: string }>(`/api/org/${orgId}/prontuarios`, { method: "POST", body: JSON.stringify(parsed.data) });
      if (!r.ok) return setErro(r.error);
      onDone({ id: r.data.id });
    });
  }

  function remover() {
    if (!p) return;
    setErro(null);
    start(async () => {
      const err = await chamarApi(`/api/org/${orgId}/prontuarios/${p.id}`, { method: "DELETE" });
      if (err) return setErro(err);
      onDone({ removido: true });
    });
  }

  const animalAtual = animais.find((a) => a.id === animalInicial);

  return (
    <Modal
      open
      onClose={onClose}
      title={p ? "Corrigir atendimento" : "Registrar atendimento"}
      subtitle={
        animalFixo && animalAtual
          ? `${rotuloAnimal(animalAtual)} · consulta da agenda`
          : "Preencha o que foi feito. O que não se aplica pode ficar em branco."
      }
      wide
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {!animalFixo && (
            <Campo label="Animal" largo>
              <Select name="animalId" defaultValue={animalInicial} required>
                <option value="" disabled>
                  Escolha o animal
                </option>
                {animais.map((a) => (
                  <option key={a.id} value={a.id}>
                    {rotuloAnimal(a)}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
          <Campo label="Data">
            <input name="data" type="date" required className={campo} defaultValue={p?.data ?? inicial?.data} />
          </Campo>
          <Campo label="Tipo">
            <Select name="tipo" defaultValue={p?.tipo ?? inicial?.tipo ?? "consulta"}>
              {TIPOS_CONSULTA.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_CONSULTA[t]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Quem atendeu" largo>
            <Select name="veterinarioId" defaultValue={p ? (p.veterinarioId ?? "") : (inicial?.veterinarioId ?? "")}>
              <option value="">Ninguém da equipe</option>
              {veterinarios.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Queixa e histórico" largo>
            <textarea
              name="queixa"
              rows={3}
              defaultValue={p?.queixa}
              placeholder="O que o dono contou, desde quando, o que já foi feito."
              className={`${campo} h-auto py-2.5 leading-relaxed`}
            />
          </Campo>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            Exame físico <span className="font-normal text-ink-muted">(com a unidade)</span>
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {MEDIDAS_EXAME.map((nome) => (
              <label key={nome} className="flex min-w-0 flex-col gap-1">
                <span className="text-[13px] text-ink-muted">{nome}</span>
                <input
                  name={`medida-${nome}`}
                  defaultValue={medidaFixa(nome)}
                  placeholder={EXEMPLO_MEDIDA[nome]}
                  className={`${campo} px-2.5`}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <Pares
          titulo="Outras medidas"
          itens={extras}
          onChange={setExtras}
          rotuloA="Medida"
          rotuloB="Valor"
          exemploA="Ex.: Perímetro escrotal"
          exemploB="Ex.: 38 cm"
          adicionar="Adicionar medida"
        />

        <Campo label="Diagnóstico">
          <textarea
            name="diagnostico"
            rows={2}
            defaultValue={p?.diagnostico}
            placeholder="O que foi encontrado e o que fazer."
            className={`${campo} h-auto py-2.5 leading-relaxed`}
          />
        </Campo>

        <Pares
          titulo="Remédios receitados"
          itens={remedios}
          onChange={setRemedios}
          rotuloA="Remédio"
          rotuloB="Como dar"
          exemploA="Ex.: Otomax"
          exemploB="Ex.: 5 gotas, 2 vezes ao dia, por 7 dias"
          adicionar="Adicionar remédio"
        />
        <Pares
          titulo="Exames pedidos"
          itens={exames}
          onChange={setExames}
          rotuloA="Exame"
          rotuloB="Resultado"
          exemploA="Ex.: Hemograma"
          exemploB="Resultado, quando sair"
          adicionar="Adicionar exame"
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            Retorno <span className="font-normal text-ink-muted">(entra na agenda)</span>
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:max-w-[22rem]">
            <input name="retornoData" type="date" aria-label="Dia do retorno" className={campo} defaultValue={p?.retorno?.data ?? ""} />
            <input name="retornoHora" type="time" aria-label="Hora do retorno" className={campo} defaultValue={p?.retorno?.hora ?? ""} />
          </div>
        </fieldset>

        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}

        {confirmarRemocao && p && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-[#efd3cc] bg-danger-bg px-4 py-3 text-[15px] text-ink">
            <span>Apagar este atendimento? Não dá para desfazer.</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirmarRemocao(false)} className={btn.secundario}>
                Não
              </button>
              <button type="button" onClick={remover} disabled={pending} className={btn.perigoSolido}>
                Apagar
              </button>
            </span>
          </div>
        )}

        <div className="-mx-6 -mb-6 flex items-center justify-between gap-2 border-t border-line px-6 py-4">
          {p && podeApagar && !confirmarRemocao ? (
            <button type="button" onClick={() => setConfirmarRemocao(true)} className={btn.perigo}>
              Apagar
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
              {p ? "Salvar" : "Registrar atendimento"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
