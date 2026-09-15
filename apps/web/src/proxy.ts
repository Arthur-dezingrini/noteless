import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Em Next 16 o antigo `middleware.ts` passou a se chamar `proxy.ts`.
 *
 * Aqui só existe checagem OTIMISTA: lemos a presença do cookie de sessão, nunca
 * o banco — o proxy roda em toda navegação, inclusive em prefetch. A validação
 * de verdade fica na DAL (`src/lib/auth/dal.ts`), perto dos dados.
 *
 * Por isso o proxy só barra quem NÃO tem cookie. Ele nunca expulsa do /login
 * quem TEM cookie: o cookie pode estar velho (sessão expirada, troca de
 * ambiente), e aí a DAL devolveria para /login e o proxy mandaria de volta —
 * loop infinito. Quem decide se um cookie ainda vale é a página de login,
 * consultando a api.
 */
const ROTAS_PROTEGIDAS = ["/dashboard", "/agenda", "/animais", "/prontuarios", "/ocorrencias", "/configuracoes"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protegida = ROTAS_PROTEGIDAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
  if (protegida && !getSessionCookie(request)) {
    const url = new URL("/login", request.nextUrl);
    // Preserva o destino para voltar depois do login.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Sem matcher o proxy rodaria também em _next/static e imagens.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
