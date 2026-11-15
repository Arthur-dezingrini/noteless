/**
 * Quanto do texto a correção pode mudar: trocar "parca" por "porca" e
 * "deitões" por "leitões" numa nota curta passa longe disto; reescrever
 * a frase, não.
 */
export const MUDANCA_MAXIMA = 0.3;

/** Distância de edição (inserir, apagar ou trocar um caractere). */
function distancia(a: string, b: string) {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j]! + 1, atual[j - 1]! + 1, anterior[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length]!;
}

const numeros = (s: string) => (s.match(/\d+/g) ?? []).join(" ");

/**
 * A transcrição que a IA corrigiu, se a correção for só de palavras mal
 * ouvidas; senão null, e fica a do Whisper. Número mudado ou texto
 * reescrito não passam: quem confere lê a transcrição como o que foi dito.
 */
export function transcricaoCorrigida(original: string, proposta: unknown): string | null {
  if (typeof proposta !== "string") return null;
  const corrigida = proposta.trim();
  const ouvida = original.trim();
  if (!corrigida || corrigida === ouvida) return null;
  if (numeros(corrigida) !== numeros(ouvida)) return null;
  const mudou = distancia(ouvida.toLowerCase(), corrigida.toLowerCase()) / Math.max(ouvida.length, corrigida.length);
  return mudou <= MUDANCA_MAXIMA ? corrigida : null;
}
