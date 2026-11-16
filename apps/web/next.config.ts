import type { NextConfig } from "next";

// A regra de /api/* é montada aqui, na hora do build. O padrão serve para dev
// e para o CI; na Vercel, sem API_URL o site subiria apontando para localhost.
if (process.env.VERCEL && !process.env.API_URL) {
  throw new Error("Cadastre API_URL (a URL da api, ex.: https://vocare-api.vercel.app) nas variáveis do projeto do front e faça Redeploy.");
}
const API_URL = process.env.API_URL ?? "http://localhost:4000";

// Em desenvolvimento o Next precisa de eval (recarga ao vivo) e de WebSocket
// (HMR); em produção, não.
const DEV = process.env.NODE_ENV !== "production";

/**
 * O que o navegador pode carregar e de onde. Tudo vem do próprio site: a
 * fonte é baixada no build (next/font), o avatar é data: e o áudio da nota
 * passa por /api. Script e estilo inline ficam liberados porque o App Router
 * hidrata a página com script inline; o que mais protege aqui é não deixar
 * a tela ser embutida em outro site nem mandar formulário para fora.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  `connect-src 'self'${DEV ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const CABECALHOS_SEGURANCA = [
  { key: "Content-Security-Policy", value: CSP },
  // Para navegador antigo que não entende frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microfone só para o próprio site (gravar nota pelo navegador); câmera e localização, ninguém.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

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

  // Cabeçalhos de segurança em toda resposta (o HSTS a Vercel já põe).
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_SEGURANCA }];
  },

  // "Ocorrências" virou "Notas". Aviso antigo (o link fica salvo no banco) e
  // favorito continuam abrindo a nota certa: a query (?id=) vai junto.
  //
  // As telas passaram a morar no endereço do módulo (Aviário, Animais,
  // Saúde). Endereço antigo redireciona, com a query junto.
  async redirects() {
    return [
      { source: "/ocorrencias", destination: "/notas", permanent: true },
      { source: "/lotes", destination: "/aviario/lotes", permanent: true },
      { source: "/lotes/:id", destination: "/aviario/lotes/:id", permanent: true },
      { source: "/configuracoes/galpoes", destination: "/aviario/galpoes", permanent: true },
      { source: "/grupos", destination: "/animais/grupos", permanent: true },
      { source: "/agenda", destination: "/saude/agenda", permanent: true },
      { source: "/prontuarios", destination: "/saude/prontuarios", permanent: true },
    ];
  },
};

export default nextConfig;
