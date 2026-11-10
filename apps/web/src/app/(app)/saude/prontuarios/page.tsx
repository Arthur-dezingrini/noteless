import { Card } from "@/components/ui";
import { getMemberRole, getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { getUsuarios } from "@/modulos/conta/dados";
import { getConsultas, getProntuarios } from "@/modulos/saude/dados";
import { getAnimais } from "@/modulos/animais/dados";
import { hojeISO } from "@/lib/datas";

import { ProntuariosView, type NovoAtendimento } from "@/modulos/saude";

export const metadata = { title: "Prontuários" };

export default async function ProntuariosPage({ searchParams }: PageProps<"/saude/prontuarios">) {
  const [{ user }, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);

  if (!org) {
    return (
      <Card padded className="text-[15px] text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
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
