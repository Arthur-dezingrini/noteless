import { createHash, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "../db";
import { gravador } from "../db/tabelas/conta";
import type { MembroAtual } from "./membro-atual";

/**
 * O gravador de campo não tem conta. Na primeira vez que liga, a placa sorteia
 * um segredo (32 bytes, em hexadecimal) e o guarda na memória dela; toda
 * chamada leva `Authorization: Gravador <série> <segredo>`. O servidor guarda
 * só o hash.
 */
const ESQUEMA = "Gravador";
const SEGREDO = /^[0-9a-f]{64}$/;

/** Domínio das contas técnicas das placas (criadas na aprovação): `.invalid` não existe, nenhum e-mail chega. */
export const DOMINIO_CONTA_GRAVADOR = "gravador.invalid";

export type CredencialGravador = { serie: string; segredo: string };

/** Série e segredo do cabeçalho, ou `null` se não for uma placa (ou vier malformado). */
export function credencialGravador(headers: Headers): CredencialGravador | null {
  const [esquema, serie, segredo, ...resto] = (headers.get("authorization") ?? "").trim().split(/\s+/);
  if (esquema !== ESQUEMA || !serie || serie.length > 32 || !segredo || !SEGREDO.test(segredo) || resto.length) return null;
  return { serie, segredo };
}

export function hashDoSegredo(segredo: string): string {
  return createHash("sha256").update(segredo).digest("hex");
}

export function segredoConfere(segredo: string, hash: string): boolean {
  const a = Buffer.from(hashDoSegredo(segredo), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Sem 0, O, 1 e I: o código é lido numa tela e digitado em outra.
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * O código que a placa mostra na página de Wi-Fi ("K7F-3QX"): os 30 primeiros
 * bits do SHA-256 de "noteless-pareamento:<segredo>". Sai do segredo, então só
 * a placa de verdade mostra o código da série que se apresentou. A placa faz a
 * mesma conta (firmware/gravador/configuracao.ino, codigoDePareamento).
 */
export function codigoDePareamento(segredo: string): string {
  const v = createHash("sha256").update(`noteless-pareamento:${segredo}`).digest().readUInt32BE(0);
  let c = "";
  for (let i = 0; i < 6; i++) c += ALFABETO[(v >>> (27 - 5 * i)) & 31];
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

/**
 * A placa aprovada que manda notas para esta empresa, vista como um membro
 * comum (a autora é a conta técnica dela); `null` se não for. Só a rota que
 * recebe o áudio aceita placa: ela não lê nem muda mais nada.
 */
export async function gravadorNaEmpresa(headers: Headers, organizationId: string): Promise<MembroAtual | null> {
  const cred = credencialGravador(headers);
  if (!cred) return null;
  const [g] = await db
    .select({
      nome: gravador.nome,
      segredoHash: gravador.segredoHash,
      aprovadoEm: gravador.aprovadoEm,
      userId: gravador.userId,
      organizationId: gravador.organizationId,
    })
    .from(gravador)
    .where(eq(gravador.serie, cred.serie))
    .limit(1);
  if (!g?.aprovadoEm || !g.userId || g.organizationId !== organizationId || !segredoConfere(cred.segredo, g.segredoHash)) return null;
  return { userId: g.userId, nome: g.nome, memberId: null, role: "member" };
}
