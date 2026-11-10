import { rotuloAnimal, type Consulta, type StatusConsulta } from "@vocare/shared";

import { type Tom } from "@/components/ui";
import { formatar } from "@/lib/datas";

export type Modo = "dia" | "semana";
export type Veterinario = { id: string; nome: string };
/** Pré-preenchimento da consulta nova (ex.: "Marcar na agenda" do relatório de vacinas). */
export type NovaConsulta = {
  animalId?: string;
  tipoConsulta?: string;
  observacoes?: string;
};
export type Dialogo = ({ tipo: "nova"; data: string } & NovaConsulta) | { tipo: "remarcar"; consulta: Consulta } | null;

export const TOM_STATUS: Record<StatusConsulta, Tom> = {
  agendada: "aviso",
  confirmada: "ok",
  urgente: "perigo",
  concluida: "neutro",
  cancelada: "neutro",
};

export const DURACOES = [15, 30, 45, 60, 120];

export function duracao(min: number) {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h ${min % 60} min`;
}

export function nomeAlvo(c: Consulta) {
  return c.animalId ? rotuloAnimal({ numero: c.animalNumero, nome: c.animalNome }) : c.animalNome;
}

/** "Quinta, 24 de setembro · hoje" */
export function tituloDia(iso: string, hoje: string) {
  const semana = formatar(iso, { weekday: "long" }).replace("-feira", "");
  const s = `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${formatar(iso, { day: "numeric", month: "long" })}`;
  return iso === hoje ? `${s} · hoje` : s;
}

/** A consulta inteira de volta, com o que mudou — o PATCH da api espera tudo. */
export function comMudanca(c: Consulta, m: Partial<Pick<Consulta, "data" | "hora" | "status">>) {
  return {
    animalId: c.animalId ?? null,
    grupoId: c.grupoId ?? null,
    veterinarioId: c.veterinarioId ?? null,
    data: m.data ?? c.data,
    hora: m.hora ?? c.hora,
    duracaoMin: c.duracaoMin,
    tipo: c.tipo,
    status: m.status ?? c.status,
    observacoes: c.observacoes ?? null,
  };
}
