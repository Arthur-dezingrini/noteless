"use client";

import { mudarGravadorSchema, sinalEmPalavras, type Empresa, type Gravador } from "@vocare/shared";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Button, ConfirmBar, Field, FormMessage, Input, Modal, Select } from "@/components/ui";
import { chamarApi } from "@/lib/api-client";
import { haQuantoTempo, TZ } from "@/lib/datas";

import { Destino, Situacao } from "./situacao";

const DIA_HORA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** O que a placa registrou como ERRO:/AVISO:, do mais novo para o mais antigo (até 50). */
function ErrosRecentes({ g }: { g: Gravador }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-[15px] font-semibold text-ink">Erros recentes</h3>
      {g.estado.erros.length === 0 ? (
        <p className="text-[15px] text-ink-muted">Nenhum erro registrado.</p>
      ) : (
        <ul className="flex max-h-64 flex-col divide-y divide-line overflow-y-auto rounded-field border border-line">
          {g.estado.erros.map((e, i) => (
            <li key={`${e.em}-${i}`} className="flex gap-3 px-3.5 py-2 text-sm">
              <span className="w-24 shrink-0 text-ink-muted tabular-nums">{DIA_HORA.format(new Date(e.em))}</span>
              <span className={e.texto.startsWith("ERRO:") ? "text-danger" : "text-ink"}>{e.texto.replace(/^(ERRO|AVISO): /, "")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 py-1.5">
      <dt className="w-32 shrink-0 text-ink-muted">{rotulo}</dt>
      <dd className="min-w-0 flex-1 break-words text-ink">{children}</dd>
    </div>
  );
}

/** O estado completo da placa; para o super usuário, também nome, empresa e esquecer. */
export function GerenciarGravador({
  gravador: g,
  empresas,
  podeMexer,
  onClose,
}: {
  gravador: Gravador | null;
  empresas: Empresa[];
  podeMexer: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [esquecer, setEsquecer] = useState(false);
  const [pending, start] = useTransition();

  const fechar = () => {
    setErro(null);
    setEsquecer(false);
    onClose();
  };

  const chamar = (init: RequestInit, depois?: () => void) =>
    start(async () => {
      const e = await chamarApi(`/api/admin/gravadores/${g!.id}`, init);
      setErro(e);
      if (!e) {
        depois?.();
        router.refresh();
      }
    });

  if (!g) return null;
  const ha = (iso: string) => haQuantoTempo(new Date(iso));
  const vinculos = `/configuracoes/vinculos?busca=${encodeURIComponent(g.conta.email)}` as Route;

  function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const dados = new FormData(ev.currentTarget);
    const empresa = dados.get("empresa");
    const parsed = mudarGravadorSchema.safeParse({
      nome: dados.get("nome"),
      ...(typeof empresa === "string" && empresa ? { organizationId: empresa } : {}),
    });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    chamar({ method: "PATCH", body: JSON.stringify(parsed.data) });
  }

  return (
    <Modal open onClose={fechar} title={g.nome} subtitle={g.serie} wide>
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col text-[15px]">
          <Linha rotulo="Situação">
            <Situacao g={g} />
          </Linha>
          <Linha rotulo="Empresa">
            <Destino g={g} />
          </Linha>
          <Linha rotulo="Conta">
            {g.conta.nome} <span className="text-ink-muted">· {g.conta.email}</span>
          </Linha>
          <Linha rotulo="Wi-Fi">
            {g.estado.wifi.rede} · sinal {sinalEmPalavras(g.estado.wifi.sinalDbm)} ({g.estado.wifi.sinalDbm} dBm) · IP {g.estado.wifi.ip}
          </Linha>
          <Linha rotulo="Fila">
            {g.estado.fila === 0 ? "Tudo enviado" : `${g.estado.fila} esperando para subir`}
            {g.estado.recusadas > 0 ? ` · ${g.estado.recusadas} recusada(s) guardada(s) no cartão` : ""}
          </Linha>
          <Linha rotulo="Cartão">
            {g.estado.cartao.ok ? `Ok${g.estado.cartao.livreGb !== null ? ` · ${g.estado.cartao.livreGb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB livres` : ""}` : "Com problema: não está gravando"}
          </Linha>
          <Linha rotulo="Ligou">
            {ha(g.estado.boot.em)} · {g.estado.boot.motivo}
          </Linha>
          <Linha rotulo="Firmware">{g.estado.versao}</Linha>
        </dl>

        <ErrosRecentes g={g} />

        {podeMexer && (
          <form onSubmit={salvar} className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Nome" className="min-w-48 flex-1">
                <Input name="nome" defaultValue={g.nome} maxLength={60} />
              </Field>
              <Field label="Empresa que recebe as notas" className="min-w-48 flex-1">
                {empresas.length === 0 ? (
                  <p className="py-2 text-[15px] text-ink-muted">A conta não está em nenhuma empresa.</p>
                ) : (
                  <Select name="empresa" defaultValue={g.destino?.id ?? ""}>
                    {!g.destino && <option value="">Escolha…</option>}
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button type="submit" variant="primario" loading={pending}>
                Salvar
              </Button>
            </div>
            <p className="text-sm text-ink-muted">
              Só aparecem as empresas a que a conta do gravador está vinculada (<Link href={vinculos}>vincular a outra</Link>). A placa confere
              a empresa antes de enviar as notas; parada, recebe a troca em até 15 min.
            </p>
          </form>
        )}

        {podeMexer && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            {esquecer ? (
              <ConfirmBar confirmLabel="Esquecer" pending={pending} onCancel={() => setEsquecer(false)} onConfirm={() => chamar({ method: "DELETE" }, fechar)}>
                Tirar {g.nome} da lista? Se a placa continuar ligada, ela reaparece no próximo aviso, com a conta que estiver usando.
              </ConfirmBar>
            ) : (
              <div>
                <Button variant="pequenoPerigo" onClick={() => setEsquecer(true)}>
                  Esquecer gravador
                </Button>
              </div>
            )}
          </div>
        )}

        <FormMessage tone="perigo">{erro}</FormMessage>
      </div>
    </Modal>
  );
}
