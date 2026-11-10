"use client";

import {
  CAMPOS_CORRIGIVEIS,
  DESTINO_OPERACAO,
  ESPECIES,
  ROTULO_ESPECIE,
  ROTULO_SEXO,
  ROTULO_TIPO_CONSULTA,
  SEXOS,
  TIPOS_CONSULTA,
  corrigirOperacao,
  ocorrenciaSchema,
  temAlvo,
  type CampoCorrigivel,
  type Especie,
  type Ocorrencia,
  type Operacao,
  type Sexo,
  type StatusOcorrencia,
  type TipoConsulta,
} from "@vocare/shared";
import { Check, ChevronDown, Loader2, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";

import { Select } from "@/components/app/select";
import { btn, campo } from "@/components/app/ui";
import { chamarApiJson } from "@/lib/api-client";
import { BRAND_NAME } from "@/lib/brand";
import { duracaoCurta, formatar, haQuantoTempo } from "@/lib/datas";

import { AnimalModal } from "../animais/animal-modal";

export type AnimalRef = { id: string; nome: string; numero: string | null; sexo: Sexo | null };
export type GrupoRef = { id: string; nome: string; animais: number };

/** Animais e grupos da conta, para dar nome aos alvos. */
type Cadastro = { animais: Map<string, AnimalRef>; grupos: Map<string, GrupoRef> };
type Correcao = Partial<Record<CampoCorrigivel, unknown>>;

/** Abaixo disto a tela pede para conferir o dado. */
const LIMIAR_ATENCAO = 70;

const ABAS: { status: StatusOcorrencia; label: string }[] = [
  { status: "pendente", label: "Para conferir" },
  { status: "confirmada", label: "Salvas" },
  { status: "descartada", label: "Descartadas" },
];

const VAZIO: Record<StatusOcorrencia, { titulo: string; texto: string }> = {
  pendente: {
    titulo: "Nada para conferir",
    texto: `Quando alguém falar no microfone do ${BRAND_NAME}, a nota aparece aqui para você conferir antes de entrar no sistema.`,
  },
  confirmada: { titulo: "Nada salvo ainda", texto: "As notas que você conferir e salvar ficam aqui." },
  descartada: { titulo: "Nenhuma nota descartada", texto: "O que for descartado fica aqui por 30 dias, caso mude de ideia." },
};

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

const ROTULO_CAMPO: Record<CampoCorrigivel, string> = {
  animalId: "Animal",
  grupoId: "Grupo",
  pesoKg: "Peso",
  texto: "Anotação",
  tipoConsulta: "Tipo",
  data: "Data",
  hora: "Hora",
  observacoes: "Observações",
  vacina: "Vacina",
  dose: "Dose",
  proximaData: "Próxima dose",
  remedio: "Remédio",
  dias: "Duração",
  carenciaDias: "Carência",
  crias: "Crias",
  nome: "Nome",
  especie: "Espécie",
  raca: "Raça",
  sexo: "Sexo",
  nascimento: "Nascimento",
};

const CAMPOS_DATA: CampoCorrigivel[] = ["data", "proximaData", "nascimento"];
const CAMPOS_INTEIROS: CampoCorrigivel[] = ["dias", "carenciaDias", "crias"];
/** Podem ficar vazios (null). */
const CAMPOS_OPCIONAIS: CampoCorrigivel[] = [
  "data", "hora", "observacoes", "dose", "proximaData", "dias", "carenciaDias", "crias", "raca", "sexo", "nascimento",
];
const CAMPOS_ESCOLHA: CampoCorrigivel[] = ["animalId", "grupoId", "tipoConsulta", "especie", "sexo"];
/** O alvo aparece na linha "nº 07 Thor → …"; na tabela, só quando falta, foi corrigido ou é grupo. */
const CAMPOS_ALVO: CampoCorrigivel[] = ["animalId", "grupoId"];

function naoEntendido(oc: Ocorrencia) {
  return oc.transcricao.trim() === "";
}

function rotulo(a: { numero: string | null; nome: string }) {
  if (a.numero && a.nome) return `nº ${a.numero} ${a.nome}`;
  return a.numero ? `nº ${a.numero}` : a.nome;
}

/** Nome do alvo: animal do cadastro, grupo, animal novo, ou o que foi dito. */
function nomeAlvo(op: Operacao, cad: Cadastro): string {
  if (op.tipo === "cadastrar_animal") return op.nome;
  if (op.grupoId) {
    const g = cad.grupos.get(op.grupoId);
    return g ? `${g.nome} (${g.animais} ${g.animais === 1 ? "animal" : "animais"})` : op.alvo;
  }
  const a = op.animalId ? cad.animais.get(op.animalId) : undefined;
  if (a) return rotulo(a);
  return op.animalId ? "animal novo" : `${op.alvo} (não encontrado)`;
}

/** "da Mimosa", "do Thor", "de Rex" (sexo não cadastrado), "do Lote 4". */
function deAlvo(op: Operacao, cad: Cadastro) {
  if (op.grupoId) return `do ${cad.grupos.get(op.grupoId)?.nome ?? op.alvo}`;
  const a = op.animalId ? cad.animais.get(op.animalId) : undefined;
  const prep = a?.sexo === "femea" ? "da" : a?.sexo === "macho" ? "do" : "de";
  return `${prep} ${a?.nome || (a ? rotulo(a) : op.alvo)}`;
}

function juntar(partes: string[]) {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** O que cada operação vira, dentro da frase do rodapé. */
function efeito(op: Operacao, cad: Cadastro): string {
  const de = deAlvo(op, cad);
  switch (op.tipo) {
    case "registrar_peso":
      return `o peso no histórico ${de}`;
    case "registrar_anotacao":
      return `a anotação no histórico ${de}`;
    case "agendar_consulta":
      return `${ARTIGO_CONSULTA[op.tipoConsulta]} ${de} na agenda`;
    case "aplicar_vacina":
      return `a vacina ${op.vacina} no histórico ${de}`;
    case "registrar_remedio":
      return `o tratamento com ${op.remedio} no histórico ${de}`;
    case "registrar_parto":
      return `o parto no histórico ${de}`;
    case "cadastrar_animal":
      return `${op.nome} no cadastro de animais`;
  }
}

/** Valor de um campo como o revisor lê. */
function formatarCampo(c: CampoCorrigivel, valor: unknown, cad: Cadastro, alvo: string): string {
  if (valor === null || valor === undefined || valor === "") {
    if (c === "animalId") return `“${alvo}” (não encontrado)`;
    if (c === "data") return "hoje";
    if (c === "hora") return "não dita";
    return "—";
  }
  switch (c) {
    case "animalId": {
      const a = cad.animais.get(String(valor));
      return a ? rotulo(a) : "animal novo";
    }
    case "grupoId":
      return cad.grupos.get(String(valor))?.nome ?? "Grupo removido";
    case "pesoKg":
      return `${Number(valor).toLocaleString("pt-BR")} kg`;
    case "tipoConsulta":
      return ROTULO_TIPO_CONSULTA[valor as TipoConsulta] ?? String(valor);
    case "especie":
      return ROTULO_ESPECIE[valor as Especie] ?? String(valor);
    case "sexo":
      return ROTULO_SEXO[valor as Sexo] ?? String(valor);
    case "dias":
    case "carenciaDias":
      return `${valor} ${valor === 1 ? "dia" : "dias"}`;
    case "data":
    case "proximaData":
    case "nascimento":
      return formatar(String(valor), { day: "2-digit", month: "2-digit", year: "numeric" });
    default:
      return String(valor);
  }
}

function opcoesDe(c: CampoCorrigivel, cad: Cadastro): { v: string; r: string }[] {
  switch (c) {
    case "animalId":
      return [...cad.animais.values()].map((a) => ({ v: a.id, r: rotulo(a) }));
    case "grupoId":
      return [...cad.grupos.values()].map((g) => ({ v: g.id, r: `${g.nome} (${g.animais})` }));
    case "tipoConsulta":
      return TIPOS_CONSULTA.map((t) => ({ v: t, r: ROTULO_TIPO_CONSULTA[t] }));
    case "especie":
      return ESPECIES.map((e) => ({ v: e, r: ROTULO_ESPECIE[e] }));
    case "sexo":
      return SEXOS.map((x) => ({ v: x, r: ROTULO_SEXO[x] }));
    default:
      return [];
  }
}

/** Campos da tabela de detalhes, na ordem de leitura. */
function camposDe(op: Operacao): CampoCorrigivel[] {
  const todos = CAMPOS_CORRIGIVEIS[op.tipo] as readonly CampoCorrigivel[];
  const corrigido = op.original ?? {};
  return [
    ...todos.filter((c) => !CAMPOS_ALVO.includes(c)),
    ...todos.filter((c) => {
      if (c === "grupoId") return !!op.grupoId;
      if (c === "animalId") return !op.grupoId && (!temAlvo(op) || "animalId" in corrigido);
      return false;
    }),
  ];
}

/**
 * Uma linha por campo, com "Corrigir". Enter confirma, Esc cancela; o valor
 * que a IA tinha proposto continua à vista ("corrigido, era “480 kg”").
 */
function CamposEditaveis({
  op,
  cad,
  editavel,
  registradoPor,
  onCorrigir,
  onDesfazer,
}: {
  op: Operacao;
  cad: Cadastro;
  editavel: boolean;
  registradoPor: string;
  onCorrigir: (c: CampoCorrigivel, valor: unknown) => void;
  onDesfazer: (c: CampoCorrigivel) => void;
}) {
  const [editando, setEditando] = useState<CampoCorrigivel | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const atual = op as Record<string, unknown>;
  const original = op.original ?? {};

  function abrir(c: CampoCorrigivel) {
    setErro(null);
    setEditando(c);
    setRascunho(atual[c] == null ? "" : String(atual[c]));
  }

  function confirmar(c: CampoCorrigivel, bruto = rascunho) {
    let valor: unknown = bruto.trim();
    if (valor === "") {
      if (!CAMPOS_OPCIONAIS.includes(c)) return setErro("Este campo não pode ficar vazio.");
      valor = null;
    } else if (c === "pesoKg") {
      valor = Number(bruto.replace(",", "."));
      if (!Number.isFinite(valor) || (valor as number) <= 0) return setErro("Informe um peso maior que zero.");
    } else if (CAMPOS_INTEIROS.includes(c)) {
      valor = Number(bruto);
      if (!Number.isInteger(valor) || (valor as number) < 0) return setErro("Informe um número inteiro.");
    }
    onCorrigir(c, valor);
    setEditando(null);
  }

  function teclas(e: KeyboardEvent, c: CampoCorrigivel) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar(c);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditando(null);
    }
  }

  function entrada(c: CampoCorrigivel) {
    const comum = { autoFocus: true, "aria-label": ROTULO_CAMPO[c], onKeyDown: (e: KeyboardEvent) => teclas(e, c) };
    if (CAMPOS_ESCOLHA.includes(c)) {
      return (
        <Select {...comum} value={rascunho} onChange={(e) => confirmar(c, e.target.value)} className="min-w-0 flex-[1_1_10rem]">
          {(c === "animalId" || c === "grupoId" || c === "sexo") && <option value="">{c === "sexo" ? "Não informado" : "Escolha…"}</option>}
          {opcoesDe(c, cad).map((o) => (
            <option key={o.v} value={o.v}>
              {o.r}
            </option>
          ))}
        </Select>
      );
    }
    return (
      <input
        {...comum}
        type={CAMPOS_DATA.includes(c) ? "date" : c === "hora" ? "time" : "text"}
        inputMode={c === "pesoKg" ? "decimal" : CAMPOS_INTEIROS.includes(c) ? "numeric" : undefined}
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        className="h-[34px] min-w-0 flex-[1_1_10rem] rounded-lg border border-brand bg-white px-2.5 text-sm text-ink outline-none"
      />
    );
  }

  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-[18px] gap-y-1.5 rounded-field border border-line-soft bg-detail px-3.5 py-2.5 text-sm">
      {camposDe(op).map((c) => {
        const corrigido = c in original;
        return (
          <div key={c} className="contents">
            <dt className="text-ink-muted">{ROTULO_CAMPO[c]}</dt>
            <dd className="flex min-h-[30px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              {editando === c ? (
                <>
                  {entrada(c)}
                  {!CAMPOS_ESCOLHA.includes(c) && (
                    <button type="button" onClick={() => confirmar(c)} className="h-[34px] cursor-pointer rounded-lg bg-ink px-3 text-[13px] font-semibold text-white">
                      Pronto
                    </button>
                  )}
                  <button type="button" onClick={() => setEditando(null)} className="h-[34px] cursor-pointer rounded-lg px-2 text-[13px] font-semibold text-ink-soft">
                    Cancelar
                  </button>
                  {erro && <span className="basis-full text-[13px] text-danger">{erro}</span>}
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">{formatarCampo(c, atual[c], cad, op.alvo)}</span>
                  {corrigido && (
                    <>
                      <span className="text-[13px] text-brand-ink">corrigido, era “{formatarCampo(c, original[c], cad, op.alvo)}”</span>
                      {editavel && (
                        <button type="button" onClick={() => onDesfazer(c)} className="cursor-pointer text-[13px] font-semibold text-ink-soft underline underline-offset-[3px]">
                          Desfazer
                        </button>
                      )}
                    </>
                  )}
                  {editavel && (
                    <button
                      type="button"
                      onClick={() => abrir(c)}
                      aria-label={`Corrigir ${ROTULO_CAMPO[c].toLowerCase()}`}
                      className="ml-auto cursor-pointer rounded-md px-2 py-1 text-[13px] font-semibold text-ink-soft hover:bg-[#efede8]"
                    >
                      Corrigir
                    </button>
                  )}
                </>
              )}
            </dd>
          </div>
        );
      })}
      <dt className="text-ink-muted">Registrado por</dt>
      <dd className="flex min-h-[30px] items-center font-semibold text-ink">{registradoPor}</dd>
    </dl>
  );
}

function LinhaOperacao({
  op,
  cad,
  estado,
  marcada,
  aberta,
  registradoPor,
  onToggle,
  onAbrir,
  onCorrigir,
  onDesfazer,
  onCadastrarNovo,
}: {
  op: Operacao;
  cad: Cadastro;
  estado: StatusOcorrencia;
  marcada: boolean;
  aberta: boolean;
  registradoPor: string;
  onToggle: () => void;
  onAbrir: () => void;
  onCorrigir: (c: CampoCorrigivel, valor: unknown) => void;
  onDesfazer: (c: CampoCorrigivel) => void;
  onCadastrarNovo: () => void;
}) {
  const editavel = estado === "pendente";
  const salva = estado === "confirmada";
  const bloqueada = editavel && !temAlvo(op);
  const ligada = salva ? op.aplicada !== false : editavel && marcada;
  const d = DESTINO_OPERACAO[op.tipo];
  const atual = op as Record<string, unknown>;
  const corrigidos = Object.keys(op.original ?? {}).length;
  const resumo = camposDe(op)
    .slice(0, 2)
    .map((c) => formatarCampo(c, atual[c], cad, op.alvo))
    .join(" · ");
  const linkHistorico =
    salva && op.aplicada && op.animalId && cad.animais.has(op.animalId)
      ? { href: `/animais/${op.animalId}` as const, rotulo: `Ver no histórico${op.tipo === "agendar_consulta" ? " e na agenda" : ""}` }
      : null;

  return (
    <li className={`flex items-start gap-3.5 rounded-field p-3 hover:bg-detail ${estado === "descartada" || (salva && op.aplicada === false) ? "opacity-55" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={ligada}
        aria-label={`${salva ? d.feito : d.acao}: ${nomeAlvo(op, cad)}`}
        disabled={!editavel || bloqueada}
        onClick={onToggle}
        className={`mt-px grid size-[22px] shrink-0 place-items-center rounded-md border-[1.5px] text-white ${
          ligada ? "border-brand bg-brand" : bloqueada ? "border-dashed border-[#d8b0a6] bg-white" : "border-[#c9c5bb] bg-white"
        } ${editavel && !bloqueada ? "cursor-pointer" : "cursor-default"}`}
      >
        {ligada && <Check className="size-3" strokeWidth={3.5} />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button type="button" onClick={onAbrir} aria-expanded={aberta} className="flex cursor-pointer items-start justify-between gap-3 text-left">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-base font-semibold text-ink">{salva && op.aplicada !== false ? d.feito : d.acao}</span>
            <span className="text-sm text-ink-muted">
              {nomeAlvo(op, cad)} → {d.onde}
            </span>
            {!aberta && (
              <span className="truncate text-sm text-ink-soft">
                {resumo}
                {corrigidos > 0 && " · corrigido"}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink-muted">
            {aberta ? "Menos" : "Detalhes"}
            <ChevronDown className={`size-3.5 transition ${aberta ? "rotate-180" : ""}`} />
          </span>
        </button>

        {aberta && (
          <>
            <CamposEditaveis op={op} cad={cad} editavel={editavel} registradoPor={registradoPor} onCorrigir={onCorrigir} onDesfazer={onDesfazer} />
            {op.trecho && <p className="text-sm text-ink-muted">você disse “{op.trecho}”</p>}
          </>
        )}

        {editavel && op.confianca < LIMIAR_ATENCAO && temAlvo(op) && !op.original && (
          <p className="text-sm text-warn">Confira: não temos certeza deste dado.</p>
        )}
        {bloqueada && (
          <p className="flex flex-wrap items-baseline gap-3 text-sm">
            <span className="text-danger">Não achamos “{op.alvo}” no cadastro.</span>
            <button type="button" onClick={onCadastrarNovo} className="cursor-pointer font-semibold text-ink underline underline-offset-[3px]">
              Cadastrar como animal novo
            </button>
          </p>
        )}
        {linkHistorico && (
          <Link href={linkHistorico.href} className="self-start text-sm font-semibold no-underline hover:underline">
            {linkHistorico.rotulo}
          </Link>
        )}
      </div>
    </li>
  );
}

/** Player simples do áudio original: play/pausa, barra de progresso, duração. */
function Audio({ src, duracaoSeg }: { src: string | null; duracaoSeg: number | null | undefined }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const total = duracaoSeg ?? 0;

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        disabled={!src}
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        aria-label={tocando ? "Pausar áudio" : "Ouvir áudio"}
        className="grid size-[30px] cursor-pointer place-items-center rounded-full bg-surface text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {tocando ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />}
      </button>
      <span className="relative h-0.5 max-w-60 flex-1 rounded-sm bg-[#e3dfd6]">
        <span className="absolute inset-y-0 left-0 rounded-sm bg-ink" style={{ width: `${progresso * 100}%` }} />
      </span>
      <span className="text-sm text-ink-muted tabular-nums">{src ? duracaoCurta(total) : "sem áudio guardado"}</span>
      {src && (
        <audio
          ref={ref}
          src={src}
          preload="none"
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onEnded={() => {
            setTocando(false);
            setProgresso(0);
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : total;
            setProgresso(dur ? Math.min(1, el.currentTime / dur) : 0);
          }}
        />
      )}
    </div>
  );
}

function Detalhe({
  oc,
  orgId,
  cad,
  podeSalvar,
  onAtualizada,
}: {
  oc: Ocorrencia;
  orgId: string;
  cad: Cadastro;
  podeSalvar: boolean;
  onAtualizada: (oc: Ocorrencia) => void;
}) {
  const router = useRouter();
  const estado = oc.status;
  const pendente = estado === "pendente";
  const falhou = naoEntendido(oc);
  const [marcadas, setMarcadas] = useState<Set<number>>(
    () => new Set(oc.operacoes.flatMap((op, i) => (temAlvo(op) && op.confianca >= LIMIAR_ATENCAO ? [i] : []))),
  );
  const [abertas, setAbertas] = useState<Set<number>>(() => new Set());
  const [correcoes, setCorrecoes] = useState<Record<number, Correcao>>({});
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [cadastrarPara, setCadastrarPara] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // A operação como vai ser salva: a proposta da IA com as correções por cima.
  const efetivas = oc.operacoes.map((op, i) => {
    const r = corrigirOperacao(op, correcoes[i]);
    return r.ok ? r.op : op;
  });

  function alternar(set: Set<number>, v: number) {
    const novo = new Set(set);
    if (novo.has(v)) novo.delete(v);
    else novo.add(v);
    return novo;
  }

  function corrigir(i: number, c: CampoCorrigivel, valor: unknown) {
    setCorrecoes((x) => ({ ...x, [i]: { ...x[i], [c]: valor } }));
    // Escolher o animal (ou grupo) que faltava libera a ação: já deixa marcada.
    if (CAMPOS_ALVO.includes(c) && valor) setMarcadas((s) => new Set(s).add(i));
  }

  function desfazer(i: number, c: CampoCorrigivel) {
    setCorrecoes((x) => {
      const resto = { ...x[i] };
      delete resto[c];
      return { ...x, [i]: resto };
    });
    const base = oc.operacoes[i];
    if (CAMPOS_ALVO.includes(c) && base && !temAlvo(base)) {
      setMarcadas((s) => {
        const novo = new Set(s);
        novo.delete(i);
        return novo;
      });
    }
  }

  function agir(acao: "confirmar" | "descartar" | "encaminhar" | "restaurar" | "texto") {
    setErro(null);
    start(async () => {
      const corpo = acao === "confirmar" ? { operacoes: [...marcadas], correcoes } : acao === "texto" ? { texto } : {};
      const r = await chamarApiJson<unknown>(`/api/org/${orgId}/ocorrencias/${oc.id}/${acao}`, {
        method: "POST",
        body: JSON.stringify(corpo),
      });
      if (!r.ok) return setErro(r.error);
      const parsed = ocorrenciaSchema.safeParse(r.data);
      if (parsed.success) onAtualizada(parsed.data);
    });
  }

  const escolhidas = efetivas.filter((_, i) => marcadas.has(i));
  const n = escolhidas.length;
  const totalCorrigidos = efetivas.reduce((t, op) => t + Object.keys(op.original ?? {}).length, 0);
  const todasAbertas = oc.operacoes.length > 0 && oc.operacoes.every((_, i) => abertas.has(i));

  let frase = n ? `Ao salvar, o sistema registra ${juntar(escolhidas.map((op) => efeito(op, cad)))}.` : "Nada marcado. Marque o que deve entrar no sistema.";
  if (!podeSalvar && n) {
    frase = `Só administradores salvam no sistema. Um administrador vai conferir e salvar ${n > 1 ? `estas ${n} ações` : "esta ação"}.`;
  }
  if (pendente && totalCorrigidos) frase += ` Você corrigiu ${totalCorrigidos} ${totalCorrigidos > 1 ? "dados" : "dado"}.`;

  const status =
    falhou && pendente
      ? { rotulo: "Não entendido", cor: "text-danger" }
      : {
          pendente: { rotulo: "Para conferir", cor: "text-warn" },
          confirmada: { rotulo: "Salva", cor: "text-brand-ink" },
          descartada: { rotulo: "Descartada", cor: "text-ink-muted" },
        }[estado];

  return (
    <section aria-label="Nota" className="flex min-w-0 flex-[999_1_28rem] flex-col rounded-card border border-line bg-white">
      <div className="flex flex-col gap-3.5 px-6 py-5">
        <div className="flex items-baseline justify-between gap-3 text-[15px]">
          <span>
            <b className="font-semibold text-ink">{oc.criadoPorNome}</b>
            <span className="text-ink-muted">
              {oc.criadoPorCargo && ` · ${oc.criadoPorCargo}`} · <span suppressHydrationWarning>{haQuantoTempo(oc.createdAt)}</span>
            </span>
          </span>
          <span className={`font-semibold ${status.cor}`}>{status.rotulo}</span>
        </div>
        {!falhou && <blockquote className="text-[17px] leading-relaxed text-pretty text-ink">“{oc.transcricao}”</blockquote>}
        <Audio src={oc.temAudio ? `/api/org/${orgId}/ocorrencias/${oc.id}/audio` : null} duracaoSeg={oc.duracaoSeg} />
      </div>

      {falhou && pendente && (
        <div className="flex flex-col gap-3.5 border-t border-line-soft px-6 pt-5 pb-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-base font-semibold text-danger">Não conseguimos entender este áudio</p>
            <p className="text-[15px] leading-normal text-ink-soft">Pode ter tido muito barulho ou o som ficou baixo. Ouça e escreva o que foi dito.</p>
          </div>
          {escrevendo && (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              autoFocus
              aria-label="O que foi dito no áudio"
              placeholder="Ex.: Dei vermífugo na Bolota, 5 ml."
              className={`${campo} h-auto resize-y py-2.5 leading-normal`}
            />
          )}
          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {escrevendo ? (
              <button type="button" disabled={pending || texto.trim().length < 3} onClick={() => agir("texto")} className={btn.primario}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Enviar texto
              </button>
            ) : (
              <button type="button" onClick={() => setEscrevendo(true)} className={btn.secundario}>
                Escrever o que foi dito
              </button>
            )}
            {podeSalvar && (
              <button type="button" disabled={pending} onClick={() => agir("descartar")} className={btn.perigo}>
                Descartar
              </button>
            )}
          </div>
        </div>
      )}

      {efetivas.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3 border-t border-line-soft px-6 pt-4 pb-1.5">
            <h2 className="text-sm font-semibold text-ink-muted">
              {pendente ? "O que vai ser feito no sistema" : estado === "confirmada" ? "O que foi feito no sistema" : "O que ia ser feito"}
            </h2>
            <button
              type="button"
              onClick={() => setAbertas(todasAbertas ? new Set() : new Set(oc.operacoes.map((_, i) => i)))}
              className="cursor-pointer text-sm font-semibold text-ink-soft"
            >
              {todasAbertas ? "Esconder detalhes" : "Mostrar detalhes"}
            </button>
          </div>
          <ul className="flex flex-col px-3 pb-2.5">
            {efetivas.map((op, i) => (
              <LinhaOperacao
                key={i}
                op={op}
                cad={cad}
                estado={estado}
                marcada={marcadas.has(i)}
                aberta={abertas.has(i)}
                registradoPor={oc.criadoPorNome}
                onToggle={() => setMarcadas((s) => alternar(s, i))}
                onAbrir={() => setAbertas((s) => alternar(s, i))}
                onCorrigir={(c, v) => corrigir(i, c, v)}
                onDesfazer={(c) => desfazer(i, c)}
                onCadastrarNovo={() => setCadastrarPara(i)}
              />
            ))}
          </ul>
        </>
      )}

      {!falhou && efetivas.length === 0 && (
        <p className="border-t border-line-soft px-6 py-5 text-[15px] text-ink-muted">Nenhuma ação encontrada neste áudio.</p>
      )}

      {pendente && !falhou && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line-soft px-6 py-3.5">
          <p className="flex-[1_1_18rem] text-sm leading-snug text-pretty text-ink-soft">
            {podeSalvar && oc.encaminhadaPorNome && <>{oc.encaminhadaPorNome} conferiu e mandou para você. </>}
            {frase}
          </p>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              {podeSalvar && (
                <button type="button" disabled={pending} onClick={() => agir("descartar")} className={btn.perigo}>
                  Descartar
                </button>
              )}
              {podeSalvar ? (
                <button type="button" disabled={pending || n === 0} onClick={() => agir("confirmar")} className={`${btn.primario} px-[18px]`}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {n === 0 ? "Nada marcado" : `Salvar ${n} ${n === 1 ? "ação" : "ações"}`}
                </button>
              ) : oc.encaminhadaEm ? (
                <span className="text-sm text-ink-muted">
                  Mandada para o administrador <span suppressHydrationWarning>{haQuantoTempo(oc.encaminhadaEm)}</span>.
                </span>
              ) : (
                <button type="button" disabled={pending || n === 0} onClick={() => agir("encaminhar")} className={btn.primario}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Mandar para o administrador
                </button>
              )}
            </div>
            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}
          </div>
        </div>
      )}

      {estado === "confirmada" && (
        <p className="border-t border-line-soft px-6 py-3.5 text-sm text-ink-muted">
          Conferido e salvo{oc.revisadoPorNome && ` por ${oc.revisadoPorNome}`}
          {oc.revisadoEm && (
            <>
              {" "}
              <span suppressHydrationWarning>{haQuantoTempo(oc.revisadoEm)}</span>
            </>
          )}
          .
        </p>
      )}

      {estado === "descartada" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-6 py-3.5">
          <span className="text-sm text-ink-muted">Nada disto entrou no sistema. Fica guardado aqui por 30 dias.</span>
          {podeSalvar && (
            <button type="button" disabled={pending} onClick={() => agir("restaurar")} className={btn.secundario}>
              Voltar para conferir
            </button>
          )}
        </div>
      )}

      {cadastrarPara !== null && (
        <AnimalModal
          animal={null}
          orgId={orgId}
          possoRemover={false}
          inicial={{ nome: oc.operacoes[cadastrarPara]?.alvo }}
          onClose={() => setCadastrarPara(null)}
          onDone={(r) => {
            const i = cadastrarPara;
            setCadastrarPara(null);
            // O animal novo passa a ser o alvo; a lista de animais vem no refresh.
            if (r?.criadoId) corrigir(i, "animalId", r.criadoId);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function ItemLista({ oc, ativa, onClick }: { oc: Ocorrencia; ativa: boolean; onClick: () => void }) {
  const falhou = naoEntendido(oc);
  const n = oc.operacoes.length;
  const atencao = oc.operacoes.filter((op) => !temAlvo(op) || op.confianca < LIMIAR_ATENCAO).length;
  let resumo = `${n} ${n === 1 ? "ação" : "ações"} no sistema`;
  let ponto = "bg-[#c9c5bb]";
  let cor = "text-ink-muted";
  if (falhou) {
    resumo = "Não entendemos o áudio";
    ponto = "bg-danger";
    cor = "text-danger";
  } else if (oc.status === "pendente" && atencao) {
    resumo += ` · ${atencao} para conferir`;
    ponto = "bg-warn-dot";
  } else if (oc.status === "confirmada") {
    ponto = "bg-brand";
  }
  if (oc.status === "pendente" && oc.encaminhadaEm) resumo += " · mandada ao administrador";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={ativa ? "true" : undefined}
        className={`flex w-full cursor-pointer flex-col gap-1 rounded-field px-3.5 py-3 text-left transition ${ativa ? "bg-surface" : "hover:bg-hover"}`}
      >
        <span className="flex justify-between gap-2 text-[15px]">
          <span className="truncate font-semibold text-ink">{oc.criadoPorNome}</span>
          <span className="shrink-0 text-ink-muted" suppressHydrationWarning>
            {haQuantoTempo(oc.createdAt)}
          </span>
        </span>
        <span className="truncate text-[15px] text-ink-soft">{falhou ? `Áudio de ${duracaoCurta(oc.duracaoSeg ?? 0)}` : oc.transcricao}</span>
        <span className={`flex items-center gap-1.5 text-sm ${cor}`}>
          <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${ponto}`} />
          {resumo}
        </span>
      </button>
    </li>
  );
}

export function NotasView({
  orgId,
  ocorrencias: iniciais,
  animais: listaAnimais,
  grupos: listaGrupos,
  podeSalvar,
  selecionarId,
}: {
  orgId: string;
  ocorrencias: Ocorrencia[];
  animais: AnimalRef[];
  grupos: GrupoRef[];
  podeSalvar: boolean;
  /** Vindo de uma notificação: abre esta ocorrência, na aba certa. */
  selecionarId?: string;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [anteriores, setAnteriores] = useState(iniciais);
  if (anteriores !== iniciais) {
    setAnteriores(iniciais);
    setLista(iniciais);
  }
  const [aba, setAba] = useState<StatusOcorrencia>(() => iniciais.find((o) => o.id === selecionarId)?.status ?? "pendente");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(selecionarId ?? null);
  const cad: Cadastro = {
    animais: new Map(listaAnimais.map((a) => [a.id, a])),
    grupos: new Map(listaGrupos.map((g) => [g.id, g])),
  };

  function substituir(oc: Ocorrencia) {
    setLista((l) => l.map((x) => (x.id === oc.id ? oc : x)));
    setAba(oc.status);
    setSelecionadaId(oc.id);
    // Salvar cria consulta/anotação/peso: as outras telas (e o contador do menu) precisam ver.
    router.refresh();
  }

  const visiveis = lista.filter((o) => o.status === aba);
  const selecionada = visiveis.find((o) => o.id === selecionadaId) ?? visiveis[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-ink">Notas</h1>
        <p className="text-base text-ink-muted">O que foi falado no microfone do {BRAND_NAME}. Nada entra no sistema antes de alguém conferir.</p>
      </div>

      <div role="tablist" aria-label="Situação" className="flex gap-6 border-b border-line">
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
              {t.label} <span className="ml-0.5 font-medium text-ink-muted tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <div className="flex max-w-xl flex-col gap-1.5 py-6">
          <p className="text-lg font-semibold text-ink">{VAZIO[aba].titulo}</p>
          <p className="text-[15px] leading-relaxed text-ink-soft">{VAZIO[aba].texto}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-7">
          <ul aria-label="Notas" className="flex max-w-[310px] min-w-0 flex-[1_1_15rem] flex-col gap-0.5">
            {visiveis.map((oc) => (
              <ItemLista key={oc.id} oc={oc} ativa={oc.id === selecionada?.id} onClick={() => setSelecionadaId(oc.id)} />
            ))}
          </ul>
          {selecionada && (
            <Detalhe
              key={`${selecionada.id}-${selecionada.status}-${selecionada.transcricao.length}`}
              oc={selecionada}
              orgId={orgId}
              cad={cad}
              podeSalvar={podeSalvar}
              onAtualizada={substituir}
            />
          )}
        </div>
      )}
    </div>
  );
}
