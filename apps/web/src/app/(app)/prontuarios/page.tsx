import {
  getAnimais,
  getConsultas,
  getMemberRole,
  getOrgAtiva,
  getProntuarios,
  getUsuarios,
  requireSession,
} from "@/lib/auth/dal";
import { hojeISO } from "@/lib/datas";

import { ProntuariosView, type NovoAtendimento } from "./prontuarios-view";

export const metadata = { title: "Prontuários" };

export default async function ProntuariosPage({ searchParams }: PageProps<"/prontuarios">) {
  const [{ user }, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);

  if (!org) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-[15px] text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  const consultaId = typeof q.consulta === "string" ? q.consulta : undefined;
  const animalId = typeof q.animal === "string" ? q.animal : undefined;
  let selecionarId = typeof q.id === "string" ? q.id : undefined;

  const [prontuarios, animais, usuarios, membro, consultas] = await Promise.all([
    getProntuarios(org.id),
    getAnimais(org.id),
    getUsuarios(org.id),
    getMemberRole(org.id),
    consultaId ? getConsultas(org.id) : Promise.resolve([]),
  ]);

  // Vindo da agenda (?consulta=) o formulário já nasce com a consulta; se ela
  // já tem atendimento, mostra o atendimento em vez de abrir outro.
  let nova: NovoAtendimento | undefined;
  const cons = consultas.find((c) => c.id === consultaId);
  if (cons?.prontuarioId) selecionarId = cons.prontuarioId;
  else if (cons?.animalId) {
    nova = { consultaId: cons.id, animalId: cons.animalId, data: cons.data, tipo: cons.tipo, veterinarioId: cons.veterinarioId ?? user.id };
  } else if (animalId) {
    nova = { animalId, data: hojeISO(), tipo: "consulta", veterinarioId: user.id };
  }

  return (
    <ProntuariosView
      orgId={org.id}
      hoje={hojeISO()}
      prontuarios={prontuarios}
      animais={animais.map((a) => ({ id: a.id, nome: a.nome, numero: a.numero ?? null }))}
      veterinarios={usuarios.map((u) => ({ id: u.id, nome: u.name }))}
      eu={user.id}
      podeApagar={membro?.role === "owner" || membro?.role === "admin"}
      selecionarId={selecionarId}
      nova={nova}
    />
  );
}
