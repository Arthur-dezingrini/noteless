import type { Firmware } from "@vocare/shared";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "../../../db";
import { user } from "../../../db/schema";
import { firmware } from "../../../db/tabelas/conta";

/** Versões publicadas, da mais nova para a mais antiga (sem o arquivo). */
export async function listarFirmwares(): Promise<Firmware[]> {
  const linhas = await db
    .select({ versao: firmware.versao, tamanho: firmware.tamanho, sha256: firmware.sha256, em: firmware.createdAt, por: user.name })
    .from(firmware)
    .leftJoin(user, eq(user.id, firmware.publicadoPorId))
    .orderBy(desc(firmware.createdAt));
  return linhas.map((l) => ({ versao: l.versao, tamanho: l.tamanho, sha256: l.sha256, publicadoEm: l.em.toISOString(), publicadoPor: l.por }));
}

/** Um pedaço do arquivo, lido no próprio banco (substring): não traz o firmware inteiro a cada pedido. */
export async function pedacoDoFirmware(versao: string, inicio: number, comprimento: number): Promise<Buffer> {
  const [l] = await db
    .select({ pedaco: sql<Uint8Array>`substring(${firmware.dados} from ${inicio + 1} for ${comprimento})` })
    .from(firmware)
    .where(eq(firmware.versao, versao))
    .limit(1);
  return l ? Buffer.from(l.pedaco) : Buffer.alloc(0);
}
