import { falha, ok, type Resultado } from "../../../base/resultado";

/** Falha de regra dentro de uma transação: desfaz tudo e vira resposta HTTP. */
export class FalhaLote extends Error {
  constructor(
    readonly status: 404 | 409 | 422,
    message: string,
  ) {
    super(message);
  }
}

/** Roda `fn`; uma `FalhaLote` lançada lá dentro vira `falha` (e a transação, se houver, é desfeita). */
export async function capturar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof FalhaLote) return falha(e.status, e.message);
    throw e;
  }
}

/** Violação de unicidade do Postgres (nome de galpão, código de lote). */
export function nomeRepetido(e: unknown) {
  const erro = e as { code?: string; cause?: { code?: string } };
  return erro?.code === "23505" || erro?.cause?.code === "23505";
}
