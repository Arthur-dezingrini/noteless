"use client";

import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

import { duracaoCurta } from "@/lib/datas";

/** Player simples do áudio original: play/pausa, barra de progresso, duração. */
export function Audio({ src, duracaoSeg }: { src: string | null; duracaoSeg: number | null | undefined }) {
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
