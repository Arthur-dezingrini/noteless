import { createHash, sign } from "node:crypto";

import { FIRMWARE_TAMANHO_MAXIMO, type FirmwareOferecido } from "@vocare/shared";
import { eq, isNotNull } from "drizzle-orm";

import { segredoConfere, type CredencialGravador } from "../../../base/gravador-atual";
import { falha, ok, type Resultado } from "../../../base/resultado";
import { db } from "../../../db";
import { firmware, gravador } from "../../../db/tabelas/conta";
import { env } from "../../../env";

/**
 * Atualização do firmware sem fio. O super usuário publica o .bin; a api lê a
 * versão de dentro dele, calcula o SHA-256 e assina; o aviso de estado oferece
 * a versão-alvo à placa, que baixa em pedaços, confere a assinatura com a chave
 * pública embutida nela e instala na outra cópia (firmware/gravador/atualizacao.ino).
 */

const MARCA = "NOTELESS_FW_VERSAO=";
const VERSAO = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** A versão marcada no firmware (gravador.ino, MARCA_VERSAO); null se não houver. */
export function versaoDoFirmware(bin: Uint8Array): string | null {
  const texto = Buffer.from(bin.buffer, bin.byteOffset, bin.byteLength).toString("latin1");
  const i = texto.indexOf(MARCA);
  if (i < 0) return null;
  const m = /^[0-9.]+/.exec(texto.slice(i + MARCA.length, i + MARCA.length + 16));
  return m && VERSAO.test(m[0]) ? m[0] : null;
}

/** Chave da variável de ambiente; na Vercel, as quebras de linha às vezes chegam como "\n". */
export function chavePrivadaFirmware(): string | null {
  const k = env.FIRMWARE_CHAVE_PRIVADA?.replace(/\\n/g, "\n").trim();
  return k || null;
}

/** ECDSA P-256 sobre o arquivo inteiro (SHA-256), em DER e base64: o que a placa confere. */
export function assinarFirmware(bin: Uint8Array, chavePem: string): string {
  return sign("sha256", bin, chavePem).toString("base64");
}

export async function publicarFirmware(
  bin: Uint8Array,
  chavePem: string,
  publicadoPorId: string,
): Promise<Resultado<{ versao: string; tamanho: number; sha256: string }>> {
  // Imagem de aplicativo da ESP32: começa pelo byte mágico 0xE9.
  if (bin.byteLength < 256 || bin[0] !== 0xe9) return falha(400, "Isto não é um firmware da ESP32 (o .bin que o arduino-cli gera).");
  if (bin.byteLength > FIRMWARE_TAMANHO_MAXIMO)
    return falha(413, `Firmware grande demais para atualizar sem fio (máximo ${Math.floor(FIRMWARE_TAMANHO_MAXIMO / 1024)} KB).`);
  const versao = versaoDoFirmware(bin);
  if (!versao) return falha(400, "Não achei a versão dentro do arquivo (NOTELESS_FW_VERSAO). Ele é do gravador?");

  let assinatura: string;
  try {
    assinatura = assinarFirmware(bin, chavePem);
  } catch {
    return falha(422, "FIRMWARE_CHAVE_PRIVADA não é uma chave EC P-256 válida (PEM).");
  }
  const sha256 = createHash("sha256").update(bin).digest("hex");
  const [novo] = await db
    .insert(firmware)
    .values({ versao, tamanho: bin.byteLength, sha256, assinatura, dados: Buffer.from(bin), publicadoPorId })
    .onConflictDoNothing({ target: firmware.versao })
    .returning({ versao: firmware.versao });
  if (!novo) return falha(409, `A versão ${versao} já foi publicada. Aumente FIRMWARE_VERSAO no gravador.ino.`);
  return ok({ versao, tamanho: bin.byteLength, sha256 });
}

async function existe(versao: string): Promise<boolean> {
  const [f] = await db.select({ versao: firmware.versao }).from(firmware).where(eq(firmware.versao, versao)).limit(1);
  return Boolean(f);
}

/** Todas as placas aprovadas passam a ter essa versão como alvo. */
export async function atualizarTodas(versao: string): Promise<Resultado<{ placas: number }>> {
  if (!(await existe(versao))) return falha(404, "Versão de firmware não encontrada.");
  const mudadas = await db.update(gravador).set({ firmwareAlvo: versao }).where(isNotNull(gravador.aprovadoEm)).returning({ id: gravador.id });
  return ok({ placas: mudadas.length });
}

/** Confere que a versão existe antes de virar alvo de uma placa (null cancela). */
export async function alvoValido(versao: string | null): Promise<boolean> {
  return versao === null || existe(versao);
}

/** O que oferecer no aviso: a versão-alvo, se a placa estiver em outra. */
export async function ofertaDeFirmware(alvo: string | null, versaoDaPlaca: string): Promise<FirmwareOferecido | null> {
  if (!alvo || alvo === versaoDaPlaca) return null;
  const [f] = await db
    .select({ versao: firmware.versao, tamanho: firmware.tamanho, sha256: firmware.sha256, assinatura: firmware.assinatura })
    .from(firmware)
    .where(eq(firmware.versao, alvo))
    .limit(1);
  return f ?? null;
}

/** A placa só baixa a versão que é o alvo dela; devolve o tamanho para a rota montar os pedaços. */
export async function firmwareDaPlaca(cred: CredencialGravador, versao: string): Promise<Resultado<{ tamanho: number }>> {
  const [g] = await db
    .select({ segredoHash: gravador.segredoHash, aprovadoEm: gravador.aprovadoEm, firmwareAlvo: gravador.firmwareAlvo })
    .from(gravador)
    .where(eq(gravador.serie, cred.serie))
    .limit(1);
  if (!g || !segredoConfere(cred.segredo, g.segredoHash)) return falha(403, "Placa desconhecida.");
  if (!g.aprovadoEm) return falha(403, "Placa aguardando aprovação.");
  if (g.firmwareAlvo !== versao) return falha(403, "Esta versão não foi escolhida para esta placa.");
  const [f] = await db.select({ tamanho: firmware.tamanho }).from(firmware).where(eq(firmware.versao, versao)).limit(1);
  if (!f) return falha(404, "Versão de firmware não encontrada.");
  return ok({ tamanho: f.tamanho });
}
