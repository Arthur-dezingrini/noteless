/**
 * Resposta de uma regra de negócio: o valor, ou o erro com o status HTTP que
 * a rota devolve. A regra decide a mensagem; a rota só traduz para `c.json`.
 */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; status: 400 | 403 | 404 | 409 | 413 | 422; erro: string };

export function ok<T>(valor: T): Resultado<T> {
  return { ok: true, valor };
}

export function falha(status: 400 | 403 | 404 | 409 | 413 | 422, erro: string): Resultado<never> {
  return { ok: false, status, erro };
}
