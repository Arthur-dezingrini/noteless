import {
  getAnimais,
  getConsultas,
  getOrganizations,
  getUsuarios,
  requireSession,
} from "@/lib/auth/dal";
import { hojeISO } from "@/lib/datas";

import { AgendaView } from "./agenda-view";

export const metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const [, [org]] = await Promise.all([requireSession(), getOrganizations()]);

  if (!org) {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </p>
    );
  }

  const [consultas, animais, usuarios] = await Promise.all([
    getConsultas(org.id),
    getAnimais(org.id),
    getUsuarios(org.id),
  ]);

  // "Hoje" nasce no servidor, em São Paulo, e desce como string: cliente e
  // servidor concordam no dia mesmo com fusos diferentes.
  return (
    <AgendaView
      orgId={org.id}
      hoje={hojeISO()}
      consultas={consultas}
      animais={animais.filter((a) => a.status === "ativo")}
      veterinarios={usuarios.map((u) => ({ id: u.id, nome: u.name }))}
    />
  );
}
