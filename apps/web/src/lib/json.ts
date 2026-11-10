/**
 * Lê o corpo de uma resposta da api como JSON sem derrubar a página.
 *
 * Se a api (ou algo no caminho, como a proteção de deploy da Vercel) devolver
 * HTML, `res.json()` lança e a tela inteira vira erro 500. Aqui vira `null`:
 * o schema do contrato recusa, e quem chamou trata como "sem dado" — a sessão
 * vira deslogado e a pessoa volta para o login. O motivo fica no log.
 */
export async function corpoJson(res: Response): Promise<unknown> {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch {
    console.error(
      `[api] resposta não é JSON (${res.status} ${res.headers.get("content-type") ?? "sem content-type"}) de ${res.url || "?"}: ${texto.slice(0, 120)}`,
    );
    return null;
  }
}
