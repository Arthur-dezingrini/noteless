import type { NextConfig } from "next";

// A regra de /api/* é montada aqui, na hora do build. O padrão serve para dev
// e para o CI; na Vercel, sem API_URL o site subiria apontando para localhost.
if (process.env.VERCEL && !process.env.API_URL) {
  throw new Error("Cadastre API_URL (a URL da api, ex.: https://vocare-api.vercel.app) nas variáveis do projeto do front e faça Redeploy.");
}
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // O navegador fala só com o web; /api/* é repassado para a api. Assim o
  // cookie de sessão é same-origin e não existe CORS no caminho do usuário.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/health", destination: `${API_URL}/health` },
    ];
  },
};

export default nextConfig;
