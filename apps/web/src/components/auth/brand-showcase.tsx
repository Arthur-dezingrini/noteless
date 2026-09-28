"use client";

import { useEffect, useState } from "react";

import { Logo } from "./logo";
import { SHOWCASE_SLIDES } from "@/lib/brand";

const ROTATION_MS = 7000;

export function BrandShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % SHOWCASE_SLIDES.length),
      ROTATION_MS,
    );
    return () => clearInterval(id);
  }, [paused]);

  const slide = SHOWCASE_SLIDES[active];

  return (
    <section
      className="relative hidden flex-col justify-between bg-brand p-10 text-white lg:flex lg:p-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Logo tone="light" />

      {/* aria-live para que a troca automática seja anunciada por leitor de tela */}
      <div className="max-w-lg py-16" aria-live="polite">
        <blockquote className="text-2xl leading-snug font-bold text-balance lg:text-[1.7rem]">
          &ldquo;{slide.quote}&rdquo;
        </blockquote>

        <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-6">
          {slide.stats.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd className="text-2xl font-bold">{stat.value}</dd>
              <p aria-hidden="true" className="mt-1 text-xs text-white/75">
                {stat.label}
              </p>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex gap-2">
        {SHOWCASE_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Ver destaque ${i + 1} de ${SHOWCASE_SLIDES.length}`}
            aria-current={i === active}
            className={`h-1 cursor-pointer rounded-full transition-all duration-300 ${
              i === active ? "w-7 bg-white" : "w-3 bg-white/40 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
