import { Card } from "@/components/ui";
import { getOrgAtiva, requireSession } from "@/lib/auth/dal";
import { MovimentosLista } from "@/modulos/estoque";
import { getLocais, getMovimentos, getProdutos } from "@/modulos/estoque/dados";

export const metadata = { title: "Movimentos do estoque" };

const CAMPOS = ["produtoId", "localId", "origemTipo", "loteFabricacao", "de", "ate"] as const;

export default async function MovimentosPage({ searchParams }: PageProps<"/estoque/movimentos">) {
  const [, org, q] = await Promise.all([requireSession(), getOrgAtiva(), searchParams]);
  if (!org) {
    return (
      <Card padded className="text-sm text-ink-muted">
        Você ainda não faz parte de nenhuma organização.
      </Card>
    );
  }

  const filtro = Object.fromEntries(CAMPOS.map((c) => [c, typeof q[c] === "string" && q[c] ? q[c] : undefined]));
  const numero = Math.max(1, Number.parseInt(typeof q.pagina === "string" ? q.pagina : "1", 10) || 1);
  const [pagina, produtos, locais] = await Promise.all([
    getMovimentos(org.id, { ...filtro, pagina: numero > 1 ? String(numero) : undefined }),
    getProdutos(org.id),
    getLocais(org.id),
  ]);
  return <MovimentosLista orgId={org.id} pagina={pagina} numero={numero} filtro={filtro} produtos={produtos} locais={locais} />;
}
