import { hojeISO } from "@/lib/datas";
import { consultasDeExemplo } from "@/lib/mock/agenda";

import { AgendaView } from "./agenda-view";

export const metadata = { title: "Agenda" };

export default function AgendaPage() {
  // "Hoje" nasce no servidor, em São Paulo, e desce como string: cliente e
  // servidor concordam no dia mesmo com fusos diferentes.
  const hoje = hojeISO();
  return <AgendaView hoje={hoje} consultas={consultasDeExemplo(hoje)} />;
}
