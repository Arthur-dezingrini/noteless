/** Nome do índice único violado (código 23505 do Postgres), ou `null` se o erro é outro. */
export function unicoViolado(e: unknown): string | null {
  const erro = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  if (erro?.code === "23505") return erro.constraint ?? "";
  if (erro?.cause?.code === "23505") return erro.cause.constraint ?? "";
  return null;
}
