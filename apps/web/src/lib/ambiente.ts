/**
 * Rótulo do ambiente para o aviso fixo na tela. APP_ENV é a mesma variável que
 * escolhe o banco na api (`npm run dev:hom`); nos projetos de homologação da
 * Vercel ela vale "hom". Em produção fica vazia e não aparece aviso.
 */
export function rotuloDoAmbiente(appEnv: string | undefined): string | null {
  return appEnv === "hom" ? "Homologação" : null;
}
