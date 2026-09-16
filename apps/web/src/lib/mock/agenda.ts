/**
 * DADOS DE EXEMPLO — consultas geradas em torno do dia atual, pra agenda
 * nunca parecer parada. Somem quando existir cadastro de animais e consultas.
 */
import type { Tone } from "@/components/app/badge";
import { adicionarDias } from "@/lib/datas";

export type StatusConsulta = "confirmado" | "aguardando" | "urgente" | "concluido";

export type Consulta = {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  animal: string;
  especie: string;
  tipo: string;
  tutor: string;
  veterinario: string;
  duracaoMin: number;
  status: StatusConsulta;
};

export const STATUS_CONSULTA: Record<StatusConsulta, { label: string; tone: Tone; barra: string }> = {
  confirmado: { label: "Confirmado", tone: "green", barra: "bg-brand" },
  aguardando: { label: "Aguardando", tone: "yellow", barra: "bg-amber-400" },
  urgente: { label: "Urgente", tone: "red", barra: "bg-red-500" },
  concluido: { label: "Concluído", tone: "gray", barra: "bg-line" },
};

type Semente = Omit<Consulta, "id" | "data"> & { diasApartirDeHoje: number };

const SEMENTES: Semente[] = [
  { diasApartirDeHoje: 0, hora: "08:00", animal: "Thor", especie: "Cão", tipo: "Vacinação", tutor: "Carlos Mendes", veterinario: "Dra. Ana", duracaoMin: 30, status: "confirmado" },
  { diasApartirDeHoje: 0, hora: "09:00", animal: "Luna", especie: "Gato", tipo: "Consulta clínica", tutor: "Patricia Souza", veterinario: "Dr. Marcos", duracaoMin: 60, status: "aguardando" },
  { diasApartirDeHoje: 0, hora: "10:00", animal: "Mel", especie: "Cão", tipo: "Retorno pós-cirúrgico", tutor: "Roberto Lima", veterinario: "Dra. Ana", duracaoMin: 30, status: "confirmado" },
  { diasApartirDeHoje: 0, hora: "11:30", animal: "Pipoca", especie: "Coelho", tipo: "Check-up", tutor: "Fernanda Costa", veterinario: "Dr. Marcos", duracaoMin: 45, status: "confirmado" },
  { diasApartirDeHoje: 0, hora: "15:30", animal: "Rex", especie: "Cão", tipo: "Cirurgia", tutor: "André Oliveira", veterinario: "Dra. Ana", duracaoMin: 120, status: "urgente" },
  { diasApartirDeHoje: 2, hora: "09:30", animal: "Bidu", especie: "Cão", tipo: "Vacinação", tutor: "Marina Rocha", veterinario: "Dra. Ana", duracaoMin: 30, status: "confirmado" },
  { diasApartirDeHoje: 2, hora: "14:00", animal: "Nina", especie: "Gato", tipo: "Castração", tutor: "Paulo Henrique", veterinario: "Dr. Marcos", duracaoMin: 90, status: "aguardando" },
  { diasApartirDeHoje: 4, hora: "10:00", animal: "Simba", especie: "Gato", tipo: "Consulta clínica", tutor: "Juliana Alves", veterinario: "Dra. Ana", duracaoMin: 45, status: "confirmado" },
  { diasApartirDeHoje: 9, hora: "08:30", animal: "Frida", especie: "Cão", tipo: "Retorno", tutor: "Lucas Martins", veterinario: "Dr. Marcos", duracaoMin: 30, status: "confirmado" },
  { diasApartirDeHoje: 9, hora: "11:00", animal: "Tom", especie: "Gato", tipo: "Exame de sangue", tutor: "Beatriz Nunes", veterinario: "Dra. Ana", duracaoMin: 30, status: "aguardando" },
  { diasApartirDeHoje: -3, hora: "09:00", animal: "Bolt", especie: "Cão", tipo: "Vacinação", tutor: "Rafael Dias", veterinario: "Dra. Ana", duracaoMin: 30, status: "concluido" },
];

export function consultasDeExemplo(hojeISO: string): Consulta[] {
  return SEMENTES.map(({ diasApartirDeHoje, ...c }, i) => ({
    ...c,
    id: `c-${i + 1}`,
    data: adicionarDias(hojeISO, diasApartirDeHoje),
  })).sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
}
