"use client";

import { corrigirOperacao, ocorrenciaSchema, temAlvo, type CampoCorrigivel, type Ocorrencia } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, FormMessage, Textarea } from "@/components/ui";
import { chamarApiJson } from "@/lib/api-client";
import { haQuantoTempo } from "@/lib/datas";

import { AnimalModal } from "@/modulos/animais";

import { LIMIAR_ATENCAO, CAMPOS_ALVO, naoEntendido, juntar, efeito } from "./operacao/descricao";
import { type Cadastro, type Correcao } from "./tipos";
import { LinhaOperacao } from "./operacao/linha-operacao";
import { Audio } from "./audio";

export function Detalhe({
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
    <Card as="section" aria-label="Nota" className="flex min-w-0 flex-[999_1_28rem] flex-col">
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
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              autoFocus
              aria-label="O que foi dito no áudio"
              placeholder="Ex.: Dei vermífugo na Bolota, 5 ml."
              className="resize-y"
            />
          )}
          {erro && (
<FormMessage>{erro}</FormMessage>
          )}
          <div className="flex flex-wrap gap-2">
            {escrevendo ? (
              <Button variant="primario" disabled={texto.trim().length < 3} loading={pending} onClick={() => agir("texto")}>
                Enviar texto
              </Button>
            ) : (
              <Button onClick={() => setEscrevendo(true)}>Escrever o que foi dito</Button>
            )}
            {podeSalvar && (
              <Button variant="perigo" disabled={pending} onClick={() => agir("descartar")}>
                Descartar
              </Button>
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
                <Button variant="perigo" disabled={pending} onClick={() => agir("descartar")}>
                  Descartar
                </Button>
              )}
              {podeSalvar ? (
                <Button variant="primario" disabled={n === 0} loading={pending} onClick={() => agir("confirmar")} className="px-[18px]">
                  {n === 0 ? "Nada marcado" : `Salvar ${n} ${n === 1 ? "ação" : "ações"}`}
                </Button>
              ) : oc.encaminhadaEm ? (
                <span className="text-sm text-ink-muted">
                  Mandada para o administrador <span suppressHydrationWarning>{haQuantoTempo(oc.encaminhadaEm)}</span>.
                </span>
              ) : (
                <Button variant="primario" disabled={n === 0} loading={pending} onClick={() => agir("encaminhar")}>
                  Mandar para o administrador
                </Button>
              )}
            </div>
            {erro && (
<FormMessage>{erro}</FormMessage>
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
            <Button disabled={pending} onClick={() => agir("restaurar")}>
              Voltar para conferir
            </Button>
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
    </Card>
  );
}
