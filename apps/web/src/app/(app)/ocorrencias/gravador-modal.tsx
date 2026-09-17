"use client";

import { ocorrenciaSchema, type Ocorrencia } from "@vocare/shared";
import { Loader2, Mic, RotateCcw, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/app/modal";
import { duracaoCurta } from "@/lib/datas";

type Fase =
  | { tipo: "pronto" }
  | { tipo: "gravando"; desde: number }
  | { tipo: "gravado"; blob: Blob; url: string; duracaoSeg: number }
  | { tipo: "enviando"; duracaoSeg: number };

const LIMITE_SEG = 120;

/** O que o navegador sabe gravar; Chrome/Firefox dão webm, Safari dá mp4. */
function tipoSuportado(): string {
  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidatos.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/**
 * Botão provisório de gravação: substitui, por enquanto, o áudio que vai
 * chegar por WhatsApp ou pelo gravador de campo. Grava no navegador, manda
 * para a api, e a ocorrência volta pronta para revisão.
 */
export function GravadorModal({
  open,
  orgId,
  onClose,
  onCriada,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onCriada: (oc: Ocorrencia) => void;
}) {
  const [fase, setFase] = useState<Fase>({ tipo: "pronto" });
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);

  // Relógio da gravação (e corte no limite).
  useEffect(() => {
    if (fase.tipo !== "gravando") return;
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [fase.tipo]);

  const decorrido = fase.tipo === "gravando" ? (agora - fase.desde) / 1000 : 0;
  useEffect(() => {
    if (fase.tipo === "gravando" && decorrido >= LIMITE_SEG) parar();
  });

  // O modal é desmontado ao fechar (quem renderiza só o monta aberto), então
  // limpar é soltar o microfone e a URL do preview. Se estava enviando, o
  // envio segue e a ocorrência aparece na lista mesmo assim.
  const urlPreview = useRef<string | null>(null);
  urlPreview.current = fase.tipo === "gravado" ? fase.url : null;
  useEffect(
    () => () => {
      recorder.current?.stream.getTracks().forEach((tr) => tr.stop());
      recorder.current = null;
      if (urlPreview.current) URL.revokeObjectURL(urlPreview.current);
    },
    [],
  );

  async function gravar() {
    setErro(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErro("Sem acesso ao microfone. Libere a permissão no navegador e tente de novo.");
      return;
    }
    const mime = tipoSuportado();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    pedacos.current = [];
    const desde = Date.now();
    rec.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(pedacos.current, { type: rec.mimeType || mime || "audio/webm" });
      const duracaoSeg = Math.round((Date.now() - desde) / 1000);
      if (blob.size === 0 || duracaoSeg < 1) {
        setErro("A gravação ficou vazia. Tente de novo.");
        setFase({ tipo: "pronto" });
        return;
      }
      setFase({ tipo: "gravado", blob, url: URL.createObjectURL(blob), duracaoSeg });
    };
    recorder.current = rec;
    rec.start();
    setAgora(desde);
    setFase({ tipo: "gravando", desde });
  }

  function parar() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
  }

  function descartar() {
    if (fase.tipo === "gravado") URL.revokeObjectURL(fase.url);
    setFase({ tipo: "pronto" });
    setErro(null);
  }

  async function enviar() {
    if (fase.tipo !== "gravado") return;
    const { blob, duracaoSeg, url } = fase;
    setErro(null);
    setFase({ tipo: "enviando", duracaoSeg });

    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.set("audio", new File([blob], `ocorrencia.${ext}`, { type: blob.type }));
    form.set("duracaoSeg", String(duracaoSeg));

    try {
      const res = await fetch(`/api/org/${orgId}/ocorrencias`, { method: "POST", body: form });
      const corpo: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (corpo as { error?: string } | null)?.error;
        throw new Error(msg ?? "Não foi possível processar o áudio.");
      }
      const parsed = ocorrenciaSchema.safeParse(corpo);
      if (!parsed.success) throw new Error("A api devolveu uma ocorrência fora do formato esperado.");
      URL.revokeObjectURL(url);
      onCriada(parsed.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível processar o áudio.");
      setFase({ tipo: "gravado", blob, url, duracaoSeg });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Gravar ocorrência">
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Fale como falaria no campo: o animal, o que aconteceu e o que precisa ser feito. Até{" "}
          {LIMITE_SEG / 60} minutos.
        </p>

        <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-6">
          {fase.tipo === "pronto" && (
            <button
              type="button"
              onClick={gravar}
              className="flex size-20 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand-hover focus:outline-none focus:ring-4 focus:ring-brand/30"
              aria-label="Começar a gravar"
            >
              <Mic className="size-8" />
            </button>
          )}

          {fase.tipo === "gravando" && (
            <>
              <button
                type="button"
                onClick={parar}
                className="flex size-20 animate-pulse items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-600/30"
                aria-label="Parar gravação"
              >
                <Square className="size-7 fill-current" />
              </button>
              <p className="text-sm font-semibold tabular-nums text-ink" aria-live="polite">
                Gravando · {duracaoCurta(decorrido)}
              </p>
            </>
          )}

          {(fase.tipo === "gravado" || fase.tipo === "enviando") && (
            <>
              {fase.tipo === "gravado" ? (
                <audio controls src={fase.url} className="w-full" />
              ) : (
                <div className="flex items-center gap-2 py-3 text-sm text-ink">
                  <Loader2 className="size-5 animate-spin text-brand" />
                  Transcrevendo e interpretando o áudio…
                </div>
              )}
              <p className="text-xs text-ink-muted tabular-nums">{duracaoCurta(fase.duracaoSeg)} gravado</p>
            </>
          )}
        </div>

        {erro && (
          <p role="alert" className="text-sm text-red-600">
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {fase.tipo === "gravado" && (
            <>
              <button
                type="button"
                onClick={descartar}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface"
              >
                <RotateCcw className="size-4" /> Gravar de novo
              </button>
              <button
                type="button"
                onClick={enviar}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                <Send className="size-4" /> Enviar para análise
              </button>
            </>
          )}
          {fase.tipo === "pronto" && (
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted hover:bg-surface">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
