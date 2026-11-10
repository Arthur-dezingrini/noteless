import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { hojeISO } from "@/lib/datas";
import { getGalpoesHoje } from "@/modulos/aviario/dados";
import { getOcorrencias } from "@/modulos/notas/dados";
import { Inicio } from "@/modulos/painel";
import { getAvisos } from "@/modulos/painel/dados";
import { getConsultas } from "@/modulos/saude/dados";

export const metadata = { title: "Início" };

/** Início: o que precisa de você hoje. */
export default async function InicioPage() {
  const [{ user }, org] = await Promise.all([requireSession(), getOrgAtiva()]);
  const hoje = hojeISO();

  const [consultas, ocorrencias, avisos, galpoes] = org
    ? await Promise.all([getConsultas(org.id, hoje, hoje), getOcorrencias(org.id), getAvisos(org.id), getGalpoesHoje(org.id)])
    : [[], [], [], []];
  const pendentes = ocorrencias.filter((o) => o.status === "pendente").length;
  const doDia = consultas.filter((c) => c.status !== "cancelada");
  const primeiroNome = (user.name || user.email).split(/\s+/)[0];

  return (
    <Inicio hoje={hoje} primeiroNome={primeiroNome} pendentes={pendentes} doDia={doDia} avisos={avisos} galpoes={galpoes} />
  );
}
