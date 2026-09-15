import { Construction } from "lucide-react";

export const metadata = { title: "Usuários" };

export default function UsuariosPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white px-6 py-20 text-center">
      <Construction className="size-8 text-ink-muted/60" />
      <p className="mt-4 text-sm font-medium text-ink">Usuários — em construção</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        Aqui vai a lista de membros da organização com seus papéis, e o convite
        de novos usuários.
      </p>
    </div>
  );
}
