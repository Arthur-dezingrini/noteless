import { TERMOS_EM_VIGOR } from "@vocare/shared";
import Link from "next/link";

import { cx } from "@/components/ui";

/** Links para os Termos e a Privacidade. Somem enquanto os textos estão em revisão. */
export function LinksLegais({ className }: { className?: string }) {
  if (!TERMOS_EM_VIGOR) return null;
  return (
    <p className={cx("text-sm text-ink-muted", className)}>
      <Link href="/termos" className="hover:underline">
        Termos de Uso
      </Link>
      {" · "}
      <Link href="/privacidade" className="hover:underline">
        Política de Privacidade
      </Link>
    </p>
  );
}

/** Link para a folha de aviso de quem usa o gravador. Some enquanto o texto está em revisão. */
export function LinkAvisoGravador() {
  if (!TERMOS_EM_VIGOR) return null;
  return (
    <Link href="/aviso-gravador" className="text-sm font-semibold text-brand-ink hover:underline">
      Aviso para quem usa o gravador (para imprimir)
    </Link>
  );
}
