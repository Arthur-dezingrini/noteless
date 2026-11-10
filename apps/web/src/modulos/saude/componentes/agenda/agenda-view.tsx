"use client";

import { type Animal, type Consulta } from "@vocare/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button, Card, FormMessage, PageHeader, SectionHeader, SegmentedControl } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { adicionarDias, inicioDaSemana } from "@/lib/datas";

import { Calendario } from "./calendario";
import { comMudanca, tituloDia, type Dialogo, type Modo, type NovaConsulta, type Veterinario } from "./util";
import { ConsultaModal } from "./consulta-modal";
import { LinhaConsulta } from "./linha-consulta";
import { Semana } from "./semana";

export type Props = {
  orgId: string;
  hoje: string;
  /** Dia aberto ao entrar (?dia=, vindo do "Ver na agenda"). */
  dia?: string;
  consultas: Consulta[];
  animais: Animal[];
  veterinarios: Veterinario[];
  /** Abre a janela de consulta nova já preenchida. */
  novaPara?: NovaConsulta;
};

export function AgendaView({ orgId, hoje, dia, consultas: iniciais, animais, veterinarios, novaPara }: Props) {
  const router = useRouter();
  const [consultas, setConsultas] = useState(iniciais);
  const [selecionado, setSelecionado] = useState(dia ?? hoje);
  const [modo, setModo] = useState<Modo>("dia");
  const [dialogo, setDialogo] = useState<Dialogo>(novaPara ? { tipo: "nova", data: hoje, ...novaPara } : null);
  const [erro, setErro] = useState<string | null>(null);
  const [{ ano, mes }, setMesVisivel] = useState(() => {
    const d = dia ?? hoje;
    return { ano: Number(d.slice(0, 4)), mes: Number(d.slice(5, 7)) };
  });

  // Depois de salvar, o servidor manda a lista nova; a tela acompanha.
  const [anteriores, setAnteriores] = useState(iniciais);
  if (anteriores !== iniciais) {
    setAnteriores(iniciais);
    setConsultas(iniciais);
  }

  const diasComConsulta = useMemo(() => new Set(consultas.filter((c) => c.status !== "cancelada").map((c) => c.data)), [consultas]);

  function mudarMes(delta: number) {
    setMesVisivel(({ ano, mes }) => {
      const m = mes + delta;
      if (m < 1) return { ano: ano - 1, mes: 12 };
      if (m > 12) return { ano: ano + 1, mes: 1 };
      return { ano, mes: m };
    });
  }

  function selecionar(iso: string) {
    setSelecionado(iso);
    setMesVisivel({
      ano: Number(iso.slice(0, 4)),
      mes: Number(iso.slice(5, 7)),
    });
  }

  /** Atualiza na hora (otimista) e confirma com a api; se falhar, volta. */
  async function atualizar(c: Consulta, m: Partial<Pick<Consulta, "data" | "hora" | "status">>) {
    setErro(null);
    const antes = consultas;
    setConsultas((l) => l.map((x) => (x.id === c.id ? { ...x, ...m } : x)));
    const err = await chamarApi(`/api/org/${orgId}/consultas/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify(comMudanca(c, m)),
    });
    if (err) {
      setConsultas(antes);
      setErro(err);
      return;
    }
    router.refresh();
  }

  const doDia = consultas.filter((c) => c.data === selecionado).sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description={modo === "dia" ? "Consultas, retornos e vacinas marcados." : "Arraste para remarcar."}
        actions={
          <div className="flex items-center gap-3">
            <SegmentedControl
              label="Ver por"
              value={modo}
              onChange={setModo}
              items={[
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
              ]}
            />
            <Button onClick={() => setDialogo({ tipo: "nova", data: selecionado })}>Nova consulta</Button>
          </div>
        }
      />

      {erro && <FormMessage>{erro}</FormMessage>}

      {modo === "dia" ? (
        <div className="flex flex-wrap items-start gap-7">
          <Calendario
            ano={ano}
            mes={mes}
            hoje={hoje}
            selecionado={selecionado}
            diasComConsulta={diasComConsulta}
            onSelecionar={selecionar}
            onMesAnterior={() => mudarMes(-1)}
            onMesSeguinte={() => mudarMes(1)}
          />
          <section className="flex min-w-0 flex-[1_1_27rem] flex-col gap-2.5">
            <SectionHeader title={tituloDia(selecionado, hoje)} />
            {doDia.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-button-border p-8 text-center">
                <p className="text-base text-ink-soft">Nada marcado neste dia.</p>
                <Button onClick={() => setDialogo({ tipo: "nova", data: selecionado })}>Marcar consulta</Button>
              </div>
            ) : (
              <Card as="ul">
                {doDia.map((c, i) => (
                  <LinhaConsulta
                    key={c.id}
                    c={c}
                    primeira={i === 0}
                    onConcluir={() => atualizar(c, { status: "concluida" })}
                    onCancelar={() => atualizar(c, { status: "cancelada" })}
                    onReabrir={() => atualizar(c, { status: "agendada" })}
                    onRemarcar={() => setDialogo({ tipo: "remarcar", consulta: c })}
                  />
                ))}
              </Card>
            )}
          </section>
        </div>
      ) : (
        <Semana
          consultas={consultas}
          hoje={hoje}
          inicio={inicioDaSemana(selecionado)}
          onMudarSemana={(dias) => selecionar(adicionarDias(selecionado, dias))}
          onMover={(c, data) => c.data !== data && atualizar(c, { data })}
        />
      )}

      {dialogo && (
        <ConsultaModal
          dialogo={dialogo}
          orgId={orgId}
          animais={animais}
          veterinarios={veterinarios}
          onClose={() => setDialogo(null)}
          onDone={(data) => {
            setDialogo(null);
            if (data) selecionar(data);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
