import { z } from "zod";

/**
 * Termos de Uso e Política de Privacidade. A versão é a data do texto: mudou o
 * texto, muda a versão, e todo mundo aceita de novo. Até o advogado revisar o
 * rascunho os termos ficam fora de vigor: as páginas mostram a faixa de
 * rascunho, os links somem e ninguém é levado ao aceite.
 */
export const VERSAO_TERMOS = "2026-11-16";
export const TERMOS_EM_VIGOR = false as boolean;

/** Dias que o áudio de uma nota fica guardado depois de ela ser confirmada ou descartada. */
export const DIAS_AUDIO = 90;

export const aceitarTermosSchema = z.object({
  versao: z.literal(VERSAO_TERMOS, { error: "Esta versão dos termos não é a atual. Recarregue a página." }),
});

/** O aceite de quem está logado para a versão atual; `aceitoEm` nulo = ainda não aceitou. */
export const aceiteTermosSchema = z.object({ versao: z.string(), aceitoEm: z.coerce.date().nullable() });
export type AceiteTermos = z.infer<typeof aceiteTermosSchema>;
