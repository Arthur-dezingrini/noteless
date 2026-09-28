"use client";

import {
  CAMPOS_CORRIGIVEIS,
  DESTINO_OPERACAO,
  ROTULO_STATUS_OCORRENCIA,
  ROTULO_TIPO_CONSULTA,
  TIPOS_CONSULTA,
  corrigirOperacao,
  ocorrenciaSchema,
  type CampoCorrigivel,
  type Ocorrencia,
  type Operacao,
  type Sexo,
  type StatusOcorrencia,
  type TipoConsulta,
} from "@vocare/shared";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";

import { Avatar } from "@/components/app/avatar";
import { Badge, type Tone } from "@/components/app/badge";
import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { chamarApiJson } from "@/lib/api-client";
import { duracaoCurta, formatar, haQuantoTempo } from "@/lib/datas";

export type AnimalRef = { id: string; nome: string; sexo: Sexo | null };

const TOM_STATUS: Record<StatusOcorrencia, Tone> = {
  pendente: "yellow",
  confirmada: "green",
  descartada: "gray",
};

/** Abaixo disto a tela pede para conferir o dado. */
const LIMIAR_ATENCAO = 70;

const ABAS: { status: StatusOcorrencia; label: string }[] = [
  { status: "pendente", label: "Para conferir" },
  { status: "confirmada", label: "Salvas" },
  { status: "descartada", label: "Descartadas" },
];

/** "o retorno", "a vacinação"… — para montar a frase do rodapé. */
const ARTIGO_CONSULTA: Record<TipoConsulta, string> = {
  consulta: "a consulta",
  vacinacao: "a vacinação",
  retorno: "o retorno",
  cirurgia: "a cirurgia",
  checkup: "o check-up",
  exame: "o exame",
  outro: "o atendimento",
};

function naoEntendido(oc: Ocorrencia) {
  return oc.transcricao.trim() === "";
}

/** "da Mimosa", "do Thor", "de Rex" (sexo não cadastrado). */
function deAnimal(animal: AnimalRef | undefined, nomeFalado: string) {
  const nome = animal?.nome ?? nomeFalado;
  const prep = animal?.sexo === "femea" ? "da" : animal?.sexo === "macho" ? "do" : "de";
  return `${prep} ${nome}`;
}

function juntar(partes: string[]) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** Uma linha curta com os dois primeiros dados da operação. */
function descrever(op: Operacao): string {
  switch (op.tipo) {
    case "agendar_consulta": {
      const quando = op.data ? formatar(op.data, { day: "numeric", month: "short" }) : "data a definir";
      return `${ROTULO_TIPO_CONSULTA[op.tipoConsulta]} · ${quando}${op.hora ? ` às ${op.hora}` : ""}`;
    }
    case "registrar_peso":
      return `${op.pesoKg.toLocaleString("pt-BR")} kg · ${op.detalhe}`;
    case "registrar_anotacao":
      return op.texto;
  }
}

type Correcao = Partial<Record<CampoCorrigivel, unknown>>;

/** Campo de correção, um pouco mais baixo que o padrão para caber na linha. */
const CAMPO_INPUT = `${campo} h-10`;

const ROTULO_CAMPO: Record<CampoCorrigivel, string> = {
  animalId: "Animal",
  pesoKg: "Peso",
  texto: "Anotação",
  tipoConsulta: "Tipo",
  data: "Data",
  hora: "Hora",
  observacoes: "Observações",
};

/** Valor de um campo como o revisor lê. */
function formatarCampo(campo: CampoCorrigivel, valor: unknown, animais: Map<string, AnimalRef>, alvo: string): string {
  if (valor === null || valor === undefined || valor === "") {
    return campo === "animalId" ? `“${alvo}” (não cadastrado)` : campo === "data" || campo === "hora" ? "Não dita" : "—";
  }
  switch (campo) {
    case "animalId":
      return animais.get(String(valor))?.nome ?? "Animal removido";
    case "pesoKg":
      return `${Number(valor).toLocaleString("pt-BR")} kg`;
    case "tipoConsulta":
      return ROTULO_TIPO_CONSULTA[valor as TipoConsulta] ?? String(valor);
    case "data":
      return formatar(String(valor), { weekday: "short", day: "numeric", month: "long" });
    default:
      return String(valor);
  }
}

/**
 * Uma linha por campo, com "Corrigir". Enter confirma, Esc cancela; o valor
 * que a IA tinha proposto continua à vista ("corrigido, era 480 kg").
 */
function CamposEditaveis({
  op,
  animais,
  editavel,
  onCorrigir,
  onDesfazer,
}: {
  op: Operacao;
  animais: Map<string, AnimalRef>;
  editavel: boolean;
  onCorrigir: (campo: CampoCorrigivel, valor: unknown) => void;
  onDesfazer: (campo: CampoCorrigivel) => void;
}) {
  const [editando, setEditando] = useState<CampoCorrigivel | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const atual = op as Record<string, unknown>;
  const original = op.original ?? {};

  function abrir(campo: CampoCorrigivel) {
    setErro(null);
    setEditando(campo);
    setRascunho(atual[campo] == null ? "" : String(atual[campo]));
  }

  function confirmar(campo: CampoCorrigivel, bruto = rascunho) {
    let valor: unknown = bruto.trim();
    if (campo === "pesoKg") {
      valor = Number(bruto.replace(",", "."));
      if (!Number.isFinite(valor) || (valor as number) <= 0) return setErro("Informe um peso maior que zero.");
    } else if ((campo === "data" || campo === "hora" || campo === "observacoes") && valor === "") {
      valor = null;
    } else if ((campo === "texto" || campo === "animalId") && valor === "") {
      return setErro("Este campo não pode ficar vazio.");
    }
    onCorrigir(campo, valor);
    setEditando(null);
  }

  function teclas(e: KeyboardEvent, campo: CampoCorrigivel) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar(campo);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditando(null);
    }
  }

  function entrada(campo: CampoCorrigivel) {
    const comum = {
      autoFocus: true,
      "aria-label": `Corrigir ${ROTULO_CAMPO[campo].toLowerCase()}`,
      onKeyDown: (e: KeyboardEvent) => teclas(e, campo),
    };
    if (campo === "animalId" || campo === "tipoConsulta") {
      const opcoes =
        campo === "animalId"
          ? [...animais.values()].map((a) => ({ v: a.id, r: a.nome }))
          : TIPOS_CONSULTA.map((t) => ({ v: t, r: ROTULO_TIPO_CONSULTA[t] }));
      return (
        <Select {...comum} value={rascunho} onChange={(e) => confirmar(campo, e.target.value)}>
          {campo === "animalId" && <option value="">Escolha o animal…</option>}
          {opcoes.map((o) => (
            <option key={o.v} value={o.v}>
              {o.r}
            </option>
          ))}
        </Select>
      );
    }
    const tipo = campo === "data" ? "date" : campo === "hora" ? "time" : "text";
    return (
      <input
        {...comum}
        type={tipo}
        inputMode={campo === "pesoKg" ? "decimal" : undefined}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        className={campo === "pesoKg" ? `${CAMPO_INPUT} max-w-40` : CAMPO_INPUT}
      />
    );
  }

  return (
    <dl className="grid grid-cols-[max-content_1fr] items-baseline gap-x-5 gap-y-2.5 rounded-field border border-line-soft bg-detail px-4 py-3 text-[15px]">
      {CAMPOS_CORRIGIVEIS[op.tipo].map((campo) => {
        const corrigido = campo in original;
        return (
          <div key={campo} className="contents">
            <dt className="text-ink-muted">{ROTULO_CAMPO[campo]}</dt>
            <dd className="min-w-0">
              {editando === campo ? (
                <div className="flex flex-col gap-1.5">
                  {entrada(campo)}
                  <span className="text-[13px] text-ink-muted">
                    {campo === "animalId" || campo === "tipoConsulta" ? "Escolha para confirmar" : "Enter confirma"} · Esc cancela
                  </span>
                  {erro && <span className="text-sm text-danger">{erro}</span>}
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 text-ink">
                    {formatarCampo(campo, atual[campo], animais, op.alvo)}
                    {corrigido && (
                      <span className="ml-2 text-sm text-ink-muted">
                        corrigido, era {formatarCampo(campo, original[campo], animais, op.alvo)}
                      </span>
                    )}
                  </span>
                  {editavel && (
                    <span className="flex shrink-0 gap-3">
                      {corrigido && (
                        <button type="button" onClick={() => onDesfazer(campo)} className="cursor-pointer text-sm font-semibold text-ink-muted hover:text-ink">
                          Desfazer
                        </button>
                      )}
                      <button type="button" onClick={() => abrir(campo)} className="cursor-pointer text-sm font-semibold text-brand-ink hover:underline">
                        Corrigir
                      </button>
                    </span>
                  )}
                </div>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function LinhaOperacao({
  op,
  animais,
  editavel,
  marcada,
  onToggle,
  onCorrigir,
  onDesfazer,
}: {
  op: Operacao;
  animais: Map<string, AnimalRef>;
  editavel: boolean;
  marcada: boolean;
  onToggle: () => void;
  onCorrigir: (campo: CampoCorrigivel, valor: unknown) => void;
  onDesfazer: (campo: CampoCorrigivel) => void;
}) {
  const animal = op.animalId ? animais.get(op.animalId) : undefined;
  const semAnimal = op.animalId === null;
  // Corrigido por quem confere = deixa de ser dúvida da IA.
  const incerta = op.confianca < LIMIAR_ATENCAO && !op.original;
  const [aberta, setAberta] = useState(editavel && (incerta || semAnimal));
  const d = DESTINO_OPERACAO[op.tipo];
  const salva = !editavel && op.aplicada === true;
  const naoSalva = !editavel && op.aplicada === false;
  const nome = animal?.nome ?? op.alvo;

  return (
    <li className={`flex gap-3.5 rounded-field p-3 hover:bg-detail ${naoSalva ? "opacity-60" : ""}`}>
      {editavel ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={marcada}
          aria-label={`${d.acao}: ${nome}`}
          disabled={semAnimal}
          onClick={onToggle}
          className={`mt-0.5 grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-md border-[1.5px] text-white disabled:cursor-not-allowed ${
            marcada ? "border-brand bg-brand" : semAnimal ? "border-dashed border-[#d8b0a6]" : "border-[#c9c5bb] bg-white"
          }`}
        >
          {marcada && <Check className="size-3" strokeWidth={3.5} />}
        </button>
      ) : (
        <span
          aria-hidden="true"
          className={`mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-md ${salva ? "bg-brand-soft text-brand-ink" : ""}`}
        >
          {salva && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button
          type="button"
          onClick={() => setAberta(!aberta)}
          aria-expanded={aberta}
          className="flex cursor-pointer justify-between gap-3 text-left"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-base font-semibold text-ink">{salva ? d.feito : d.acao}</span>
            <span className="text-sm text-ink-muted">
              {nome} → {d.onde}
            </span>
            {!aberta && <span className="truncate text-sm text-ink-soft">{descrever(op)}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink-muted">
            {aberta ? "Menos" : "Detalhes"}
            <ChevronDown className={`size-3.5 transition ${aberta ? "rotate-180" : ""}`} />
          </span>
        </button>

        {aberta && (
          <>
            <CamposEditaveis op={op} animais={animais} editavel={editavel} onCorrigir={onCorrigir} onDesfazer={onDesfazer} />
            {op.trecho && <p className="text-sm text-ink-muted">você disse “{op.trecho}”</p>}
          </>
        )}

        {editavel && incerta && !semAnimal && (
          <p className="text-sm text-warn">Confira: não temos certeza deste dado.</p>
        )}
        {editavel && semAnimal && (
          <p className="text-sm text-danger">
            Não achamos “{op.alvo}” no cadastro de animais. Abra os detalhes e corrija o animal para poder salvar.
          </p>
        )}
        {naoSalva && <p className="text-sm text-ink-muted">Não foi salva.</p>}
      </div>
    </li>
  );
}

/** O que o rodapé diz que vai acontecer, numa frase. */
function fraseDoRodape(ops: Operacao[], animais: Map<string, AnimalRef>, quem: "você" | "admin") {
  if (ops.length === 0) {
    return quem === "você"
      ? "Nenhuma ação marcada: ao salvar, a ocorrência é fechada sem mudar nada no sistema."
      : "Nenhuma ação marcada.";
  }
  const partes = ops.map((op) => {
    const de = deAnimal(op.animalId ? animais.get(op.animalId) : undefined, op.alvo);
    switch (op.tipo) {
      case "registrar_peso":
        return `o peso no histórico ${de}`;
      case "registrar_anotacao":
        return `a anotação no histórico ${de}`;
      case "agendar_consulta":
        return `${ARTIGO_CONSULTA[op.tipoConsulta]} ${de} na agenda`;
    }
  });
  const inicio = quem === "você" ? "Ao salvar" : "Quando o administrador salvar";
  return `${inicio}, o sistema registra ${juntar(partes)}.`;
}

function TextoManual({ orgId, oc, onAtualizada }: { orgId: string; oc: Ocorrencia; onAtualizada: (oc: Ocorrencia) => void }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const texto = String(new FormData(e.currentTarget).get("texto") ?? "");
    setErro(null);
    start(async () => {
      const r = await chamarApiJson<unknown>(`/api/org/${orgId}/ocorrencias/${oc.id}/texto`, {
        method: "POST",
        body: JSON.stringify({ texto }),
      });
      if (!r.ok) return setErro(r.error);
      const parsed = ocorrenciaSchema.safeParse(r.data);
      if (parsed.success) onAtualizada(parsed.data);
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-field border border-warn-border bg-warn-bg p-4">
      <p className="text-[15px] font-semibold text-warn">Não conseguimos entender este áudio.</p>
      <label htmlFor={`texto-${oc.id}`} className="text-[15px] text-ink">
        Escrever o que foi dito
      </label>
      <textarea
        id={`texto-${oc.id}`}
        name="texto"
        rows={3}
        required
        placeholder="Ex.: pesei a Mimosa, deu 480 quilos"
        className={`${campo} h-auto py-2.5`}
      />
      {erro && (
        <p role="alert" className="text-sm text-danger">
          {erro}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className={btn.primario}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enviar texto
        </button>
      </div>
    </form>
  );
}

function Detalhe({
  oc,
  orgId,
  animais,
  podeSalvar,
  onAtualizada,
}: {
  oc: Ocorrencia;
  orgId: string;
  animais: Map<string, AnimalRef>;
  podeSalvar: boolean;
  onAtualizada: (oc: Ocorrencia) => void;
}) {
  const pendente = oc.status === "pendente";
  // Começa marcado o que tem animal do cadastro e dado seguro.
  const [marcadas, setMarcadas] = useState<Set<number>>(
    () => new Set(oc.operacoes.flatMap((op, i) => (op.animalId && op.confianca >= LIMIAR_ATENCAO ? [i] : []))),
  );
  const [correcoes, setCorrecoes] = useState<Record<number, Correcao>>({});
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // A operação como vai ser salva: a proposta da IA com as correções por cima.
  const efetivas = oc.operacoes.map((op, i) => {
    const r = corrigirOperacao(op, correcoes[i]);
    return r.ok ? r.op : op;
  });

  function corrigir(i: number, campo: CampoCorrigivel, valor: unknown) {
    setCorrecoes((c) => ({ ...c, [i]: { ...c[i], [campo]: valor } }));
    // Escolher o animal que faltava libera a ação: já deixa marcada.
    if (campo === "animalId" && valor) setMarcadas((s) => new Set(s).add(i));
  }

  function desfazer(i: number, campo: CampoCorrigivel) {
    setCorrecoes((c) => {
      const resto = { ...c[i] };
      delete resto[campo];
      return { ...c, [i]: resto };
    });
    if (campo === "animalId" && !oc.operacoes[i]?.animalId) {
      setMarcadas((s) => {
        const novo = new Set(s);
        novo.delete(i);
        return novo;
      });
    }
  }

  function agir(acao: "confirmar" | "descartar" | "encaminhar") {
    setErro(null);
    start(async () => {
      const r = await chamarApiJson<unknown>(`/api/org/${orgId}/ocorrencias/${oc.id}/${acao}`, {
        method: "POST",
        body: JSON.stringify(acao === "confirmar" ? { operacoes: [...marcadas], correcoes } : {}),
      });
      if (!r.ok) return setErro(r.error);
      const parsed = ocorrenciaSchema.safeParse(r.data);
      if (parsed.success) onAtualizada(parsed.data);
    });
  }

  const escolhidas = efetivas.filter((_, i) => marcadas.has(i));
  const n = escolhidas.length;

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-6 py-5">
        <Avatar name={oc.criadoPorNome} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{oc.criadoPorNome}</p>
          <p className="text-sm text-ink-muted">
            <span suppressHydrationWarning>{haQuantoTempo(oc.createdAt)}</span>
            {oc.duracaoSeg != null && <> · áudio de {duracaoCurta(oc.duracaoSeg)}</>}
          </p>
        </div>
        <Badge tone={TOM_STATUS[oc.status]}>{ROTULO_STATUS_OCORRENCIA[oc.status]}</Badge>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        {naoEntendido(oc) ? (
          pendente ? (
            <TextoManual orgId={orgId} oc={oc} onAtualizada={onAtualizada} />
          ) : (
            <p className="text-[15px] text-ink-muted">Áudio não entendido.</p>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <blockquote className="text-[17px] leading-relaxed text-ink">“{oc.transcricao}”</blockquote>
            {oc.resumo && <p className="text-[15px] text-ink-muted">{oc.resumo}</p>}
          </div>
        )}

        {!naoEntendido(oc) && (
          <section className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-ink-muted">
              {pendente ? "O que vai para o sistema" : "O que foi para o sistema"}
            </h2>
            {oc.operacoes.length === 0 ? (
              <p className="py-2 text-[15px] text-ink-muted">Nenhuma ação encontrada neste áudio.</p>
            ) : (
              <ul className="-mx-3 flex flex-col">
                {efetivas.map((op, i) => (
                  <LinhaOperacao
                    key={i}
                    op={op}
                    animais={animais}
                    onCorrigir={(campo, valor) => corrigir(i, campo, valor)}
                    onDesfazer={(campo) => desfazer(i, campo)}
                    editavel={pendente}
                    marcada={marcadas.has(i)}
                    onToggle={() =>
                      setMarcadas((s) => {
                        const novo = new Set(s);
                        if (novo.has(i)) novo.delete(i);
                        else novo.add(i);
                        return novo;
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {pendente && !naoEntendido(oc) && (
        <div className="flex flex-col gap-3 border-t border-line-soft px-6 py-4">
          {podeSalvar && oc.encaminhadaPorNome && (
            <p className="text-sm text-ink-muted">{oc.encaminhadaPorNome} conferiu e mandou para você salvar.</p>
          )}
          <p className="text-[15px] text-ink-soft">{fraseDoRodape(escolhidas, animais, podeSalvar ? "você" : "admin")}</p>
          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {podeSalvar ? (
              <>
                <button type="button" disabled={pending} onClick={() => agir("descartar")} className={btn.perigo}>
                  Descartar
                </button>
                <button type="button" disabled={pending} onClick={() => agir("confirmar")} className={btn.primario}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {n === 0 ? "Fechar sem ações" : `Salvar ${n} ${n === 1 ? "ação" : "ações"}`}
                </button>
              </>
            ) : oc.encaminhadaEm ? (
              <p className="text-sm text-ink-muted">
                Mandada para o administrador <span suppressHydrationWarning>{haQuantoTempo(oc.encaminhadaEm)}</span>.
              </p>
            ) : (
              <button type="button" disabled={pending} onClick={() => agir("encaminhar")} className={btn.primario}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Mandar para o administrador
              </button>
            )}
          </div>
        </div>
      )}

      {!pendente && oc.revisadoPorNome && (
        <p className="border-t border-line-soft px-6 py-4 text-sm text-ink-muted">
          {oc.status === "confirmada" ? "Salva" : "Descartada"} por {oc.revisadoPorNome}
          {oc.revisadoEm && (
            <>
              {" "}
              · <span suppressHydrationWarning>{haQuantoTempo(oc.revisadoEm)}</span>
            </>
          )}
        </p>
      )}
    </Card>
  );
}

function ItemLista({ oc, ativa, onClick }: { oc: Ocorrencia; ativa: boolean; onClick: () => void }) {
  const acoes = oc.status === "confirmada" ? oc.operacoes.filter((o) => o.aplicada).length : oc.operacoes.length;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={ativa ? "true" : undefined}
        className={`flex w-full cursor-pointer flex-col gap-1 border-b border-line-soft px-4 py-3.5 text-left transition last:border-b-0 ${
          ativa ? "bg-surface" : "hover:bg-hover"
        }`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[15px] font-semibold text-ink">{oc.criadoPorNome}</span>
          <span className="shrink-0 text-[13px] text-ink-muted" suppressHydrationWarning>
            {haQuantoTempo(oc.createdAt)}
          </span>
        </span>
        <span className={`line-clamp-2 text-sm ${naoEntendido(oc) ? "text-warn" : "text-ink-soft"}`}>
          {naoEntendido(oc) ? "Áudio não entendido" : oc.transcricao}
        </span>
        {!naoEntendido(oc) && (
          <span className="text-[13px] text-ink-muted">
            {acoes} {acoes === 1 ? "ação" : "ações"} no sistema
            {oc.status === "pendente" && oc.encaminhadaEm && " · mandada ao administrador"}
          </span>
        )}
      </button>
    </li>
  );
}

export function OcorrenciasView({
  orgId,
  ocorrencias: iniciais,
  animais: listaAnimais,
  podeSalvar,
}: {
  orgId: string;
  ocorrencias: Ocorrencia[];
  animais: AnimalRef[];
  podeSalvar: boolean;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [aba, setAba] = useState<StatusOcorrencia>("pendente");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const animais = new Map(listaAnimais.map((a) => [a.id, a]));

  function substituir(oc: Ocorrencia) {
    setLista((l) => l.map((x) => (x.id === oc.id ? oc : x)));
    // Salvar cria consulta/anotação/peso: as outras telas (e o contador do menu) precisam ver.
    router.refresh();
  }

  const visiveis = lista.filter((o) => o.status === aba);
  const selecionada = visiveis.find((o) => o.id === selecionadaId) ?? visiveis[0];

  return (
    <>
      <PageHeader
        title="Ocorrências"
        subtitle="O que foi contado nos áudios, pronto para conferir. Nada entra no sistema sem você salvar."
      />

      <div role="tablist" aria-label="Situação" className="mb-5 flex gap-5 border-b border-line">
        {ABAS.map((t) => {
          const n = lista.filter((o) => o.status === t.status).length;
          const ativo = t.status === aba;
          return (
            <button
              key={t.status}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => {
                setAba(t.status);
                setSelecionadaId(null);
              }}
              className={`-mb-px cursor-pointer border-b-2 pb-2.5 text-[15px] transition ${
                ativo ? "border-ink font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label} <span className="ml-0.5 font-normal text-ink-muted tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <p className="text-base font-semibold text-ink">
            {aba === "pendente" ? "Nada para conferir agora." : aba === "confirmada" ? "Nenhuma ocorrência salva ainda." : "Nenhuma ocorrência descartada."}
          </p>
          {aba === "pendente" && (
            <p className="mt-1 text-[15px] text-ink-muted">Quando alguém gravar um áudio no campo, ele aparece aqui.</p>
          )}
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
          <Card className="overflow-hidden">
            <ul aria-label="Ocorrências">
              {visiveis.map((oc) => (
                <ItemLista key={oc.id} oc={oc} ativa={oc.id === selecionada?.id} onClick={() => setSelecionadaId(oc.id)} />
              ))}
            </ul>
          </Card>
          {selecionada && (
            <Detalhe
              key={`${selecionada.id}-${selecionada.status}-${selecionada.transcricao.length}`}
              oc={selecionada}
              orgId={orgId}
              animais={animais}
              podeSalvar={podeSalvar}
              onAtualizada={substituir}
            />
          )}
        </div>
      )}
    </>
  );
}
