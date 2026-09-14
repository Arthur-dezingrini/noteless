import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // O navegador fala só com o web; /api/* é repassado para a api. Assim o
  // cookie de sessão é same-origin e não existe CORS no caminho do usuário.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
