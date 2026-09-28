import { ROTULO_ESPECIE, ROTULO_SEXO } from "@vocare/shared";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardHeader } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { getFicha, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { formatar, hojeISO, idade } from "@/lib/datas";

import { Historico } from "./historico";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrgAtiva();
  const ficha = org ? await getFicha(org.id, id) : null;
  return { title: ficha?.animal.nome ?? "Animal" };
}

export default async function FichaAnimalPage({ params }: Props) {
  const { id } = await params;
  const [, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  if (!org) notFound();

  const ficha = await getFicha(org.id, id);
  if (!ficha) notFound();
  const { animal: a, grupos, historico, proximos, pendencias } = ficha;
  const anoAtual = hojeISO().slice(0, 4);

  const sobre = [
    ROTULO_ESPECIE[a.especie],
    a.raca,
    a.sexo && ROTULO_SEXO[a.sexo],
    idade(a.nascimento),
    a.tutor && `tutor ${a.tutor}`,
  ].filter(Boolean);

  const dados = [
    { rotulo: "Peso atual", valor: a.pesoKg != null ? `${a.pesoKg.toLocaleString("pt-BR")} kg` : "—" },
    { rotulo: "Nascimento", valor: a.nascimento ? formatar(a.nascimento, { day: "numeric", month: "short", year: "numeric" }) : "—" },
    { rotulo: "Grupos", valor: grupos.length ? grupos.map((g) => g.nome).join(", ") : "Nenhum" },
    { rotulo: "Situação", valor: a.status === "ativo" ? "Ativo" : "Inativo" },
  ];

  return (
    <>
      <Link href="/animais" className="mb-3 inline-flex items-center gap-1 text-[15px] font-semibold text-ink-muted no-underline hover:text-ink">
        <ChevronLeft className="size-4" /> Animais
      </Link>
      <PageHeader title={a.nome} subtitle={sobre.join(" · ")} />

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-card border border-line bg-white px-5 py-4 sm:grid-cols-4">
        {dados.map((d) => (
          <div key={d.rotulo} className="min-w-0">
            <dt className="text-sm text-ink-muted">{d.rotulo}</dt>
            <dd className="truncate text-base font-semibold text-ink">{d.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <Historico eventos={historico} />

        <div className="flex flex-col gap-5">
          {pendencias.length > 0 && (
            <section className="rounded-card border border-warn-border bg-warn-bg px-5 py-4">
              <h2 className="text-base font-semibold text-warn">Pendências</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {pendencias.map((p) => (
                  <li key={p.id} className="text-[15px] text-ink">
                    {p.texto}{" "}
                    {p.link && (
                      <Link href={p.link} className="font-semibold">
                        Conferir
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Card>
            <CardHeader title="Próximos" />
            {proximos.length === 0 ? (
              <p className="px-5 pb-5 text-[15px] text-ink-muted">Nada marcado para este animal.</p>
            ) : (
              <ul className="flex flex-col px-5 pb-4">
                {proximos.map((e) => (
                  <li key={e.id} className="flex gap-3 border-t border-line-soft py-3 first:border-t-0">
                    <span className="w-16 shrink-0 text-sm font-semibold text-ink tabular-nums">
                      {formatar(e.data, {
                        day: "2-digit",
                        month: "short",
                        ...(e.data.slice(0, 4) !== anoAtual && { year: "numeric" }),
                      })}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] text-ink">{e.titulo}</span>
                      {e.detalhe && <span className="block text-sm text-ink-muted">{e.detalhe}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
