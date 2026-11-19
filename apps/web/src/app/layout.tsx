import type { Metadata } from "next";
import { Figtree } from "next/font/google";

import { rotuloDoAmbiente } from "@/lib/ambiente";
import { BRAND_NAME } from "@/lib/brand";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description:
    "Gestão de pecuária e atendimento veterinário com registro por voz.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const ambiente = rotuloDoAmbiente(process.env.APP_ENV);
  return (
    <html lang="pt-BR" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        {/* Fixo e sem capturar clique: avisa que os dados são de teste sem mexer no layout. */}
        {ambiente && (
          <div
            role="status"
            className="pointer-events-none fixed top-2 left-1/2 z-50 -translate-x-1/2 rounded-full border border-warn-border bg-warn-bg px-3 py-1 text-xs font-semibold text-warn"
          >
            {ambiente}: dados de teste
          </div>
        )}
      </body>
    </html>
  );
}
