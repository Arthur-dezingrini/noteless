import { redirect } from "next/navigation";

export default function Home() {
  // Quem não tiver sessão é desviado para /login pelo proxy.
  redirect("/dashboard");
}
