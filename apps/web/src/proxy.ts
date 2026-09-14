import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Em Next 16 o antigo `middleware.ts` passou a se chamar `proxy.ts`.
 *
 * Aqui só existe checagem OTIMISTA: lemos a presença do cookie de sessão, nunca
 * o banco — o proxy roda em toda navegação, inclusive em prefetch. A validação
 * de verdade fica na DAL (`src/lib/auth/dal.ts`), perto dos dados.
 */
const ROTAS_PROTEGIDAS = ["/dashboard"];
const ROTAS_DE_ENTRADA = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const temCookie = Boolean(getSessionCookie(request));

  const protegida = ROTAS_PROTEGIDAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
  if (protegida && !temCookie) {
    const url = new URL("/login", request.nextUrl);
    // Preserva o destino para voltar depois do login.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (ROTAS_DE_ENTRADA.includes(pathname) && temCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Sem matcher o proxy rodaria também em _next/static e imagens.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
