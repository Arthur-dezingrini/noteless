import type { NextConfig } from "next";

// A regra de /api/* é montada aqui, na hora do build. O padrão serve para dev
// e para o CI; na Vercel, sem API_URL o site subiria apontando para localhost.
if (process.env.VERCEL && !process.env.API_URL) {
  throw new Error("Cadastre API_URL (a URL da api, ex.: https://vocare-api.vercel.app) nas variáveis do projeto do front e faça Redeploy.");
}
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Link e router.push só aceitam rota que existe em src/app: um href para
  // página que não existe vira erro no typecheck, não um 404 em produção.
  // Endereço que só se conhece em execução (link vindo da api, ?next=) entra
  // com `as Route`.
  typedRoutes: true,

  // O navegador fala só com o web; /api/* é repassado para a api. Assim o
  // cookie de sessão é same-origin e não existe CORS no caminho do usuário.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/health", destination: `${API_URL}/health` },
    ];
  },

  // "Ocorrências" virou "Notas". Aviso antigo (o link fica salvo no banco) e
  // favorito continuam abrindo a nota certa: a query (?id=) vai junto.
  async redirects() {
    return [{ source: "/ocorrencias", destination: "/notas", permanent: true }];
  },
};

export default nextConfig;
