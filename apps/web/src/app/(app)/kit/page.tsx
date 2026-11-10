import { notFound } from "next/navigation";

import { KitView } from "./kit-view";

export const metadata = { title: "Kit de UI" };

/** Catálogo do kit de UI, para consulta de quem desenvolve. Não existe em produção. */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitView />;
}
