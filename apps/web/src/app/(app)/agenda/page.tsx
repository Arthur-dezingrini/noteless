import { getConsultas, getOrgAtiva, getUsuarios, requireSession } from "@/lib/auth/dal";
import { getAnimais } from "@/modulos/animais/dados";
import { Card } from "@/components/ui";
import { hojeISO } from "@/lib/datas";

import { AgendaView } from "./agenda-view";

export const metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const [, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);

  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
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
      dia={typeof q.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.dia) ? q.dia : undefined}
      consultas={consultas}
      animais={animais.filter((a) => a.status === "ativo")}
      veterinarios={usuarios.map((u) => ({ id: u.id, nome: u.name }))}
      novaPara={
        typeof q.nova === "string"
          ? {
              animalId: q.nova,
              tipoConsulta: typeof q.tipo === "string" ? q.tipo : undefined,
              observacoes: typeof q.obs === "string" ? q.obs : undefined,
            }
          : undefined
      }
    />
  );
}
