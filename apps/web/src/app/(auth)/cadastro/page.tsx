import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta para gerenciar rebanho, manejo e atendimentos.",
};

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  redirect("/login");
}
